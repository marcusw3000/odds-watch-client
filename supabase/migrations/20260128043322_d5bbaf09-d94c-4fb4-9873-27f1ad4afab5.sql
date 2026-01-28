-- =============================================================================
-- Correção: Taxa de Liquidação Dinâmica (de hardcoded 5% para configurável)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_market_payouts(p_market_id uuid, p_winning_outcome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_market RECORD;
  v_contract RECORD;
  v_wallet_id uuid;
  v_payout_ratio NUMERIC;
  v_contract_unit NUMERIC := 1.00;
  v_gross_payout NUMERIC;
  v_fee_amount NUMERIC;
  v_net_payout NUMERIC;
  v_total_gross_payouts NUMERIC := 0;
  v_total_fees_collected NUMERIC := 0;
  v_total_net_payouts NUMERIC := 0;
  v_winners_count INTEGER := 0;
  v_losers_count INTEGER := 0;
  v_fee_rule RECORD;
  v_fee_percent NUMERIC := 0.005; -- Default 0.5% if no rule found
  v_fee_snapshot_id uuid;
BEGIN
  -- Lock market
  SELECT * INTO v_market FROM markets WHERE id = p_market_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;

  -- Fetch active fee rule for SETTLEMENT
  SELECT * INTO v_fee_rule 
  FROM fee_rules 
  WHERE type = 'SETTLEMENT' AND is_active = true 
  ORDER BY effective_from DESC 
  LIMIT 1;

  IF FOUND THEN
    -- Use configured fee based on mode
    IF v_fee_rule.mode = 'PERCENT' THEN
      v_fee_percent := COALESCE(v_fee_rule.percent_value, 0.005);
    ELSIF v_fee_rule.mode = 'FIXED' THEN
      -- For FIXED mode, we'll handle it differently per payout
      v_fee_percent := 0; -- Will use flat_value instead
    END IF;
    
    -- Create fee policy snapshot for audit trail
    INSERT INTO fee_policy_snapshots (
      fee_rule_id, type, applied_mode, applied_percent, applied_flat, applied_tiers
    ) VALUES (
      v_fee_rule.id, 
      'SETTLEMENT', 
      v_fee_rule.mode, 
      v_fee_rule.percent_value, 
      v_fee_rule.flat_value,
      v_fee_rule.tiers
    )
    RETURNING id INTO v_fee_snapshot_id;
  END IF;

  -- Determine payout ratio based on outcome
  IF p_winning_outcome = 'YES' THEN
    v_payout_ratio := 1.0;
  ELSIF p_winning_outcome = 'NO' THEN
    v_payout_ratio := 1.0;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid winning outcome');
  END IF;

  -- Process each contract for this market
  FOR v_contract IN 
    SELECT uc.*, w.id as wallet_id
    FROM user_contracts uc
    JOIN wallets w ON w.user_id = uc.user_id
    WHERE uc.market_id = p_market_id
  LOOP
    -- Get wallet ID
    v_wallet_id := v_contract.wallet_id;
    
    IF v_contract.position = p_winning_outcome THEN
      -- Winner: calculate payout with dynamic fee
      v_gross_payout := v_contract.shares * v_contract_unit * v_payout_ratio;
      
      -- Calculate fee based on rule mode
      IF v_fee_rule.mode = 'FIXED' AND v_fee_rule.flat_value IS NOT NULL THEN
        v_fee_amount := v_fee_rule.flat_value;
      ELSE
        v_fee_amount := v_gross_payout * v_fee_percent;
      END IF;
      
      -- Apply min/max fee constraints if configured
      IF v_fee_rule.min_fee IS NOT NULL AND v_fee_amount < v_fee_rule.min_fee THEN
        v_fee_amount := v_fee_rule.min_fee;
      END IF;
      IF v_fee_rule.max_fee IS NOT NULL AND v_fee_amount > v_fee_rule.max_fee THEN
        v_fee_amount := v_fee_rule.max_fee;
      END IF;
      
      -- Round fee to 2 decimal places
      v_fee_amount := ROUND(v_fee_amount, 2);
      v_net_payout := v_gross_payout - v_fee_amount;
      
      -- Credit net payout to winner's wallet
      UPDATE wallets 
      SET balance_available = balance_available + v_net_payout,
          updated_at = now()
      WHERE id = v_wallet_id;
      
      -- Create ledger entry with fee information
      INSERT INTO ledger_entries (
        user_id, wallet_id, ref_type, ref_id, direction,
        amount, fee_amount, net_amount, platform_revenue, 
        fee_snapshot_id, status, meta
      ) VALUES (
        v_contract.user_id, 
        v_wallet_id, 
        'SETTLEMENT', 
        p_market_id::text, 
        'CREDIT',
        v_gross_payout, 
        v_fee_amount, 
        v_net_payout, 
        v_fee_amount,
        v_fee_snapshot_id, 
        'COMPLETED',
        jsonb_build_object(
          'position', v_contract.position,
          'shares', v_contract.shares,
          'winning_outcome', p_winning_outcome,
          'fee_percent', v_fee_percent
        )
      );
      
      -- Accumulate totals
      v_total_gross_payouts := v_total_gross_payouts + v_gross_payout;
      v_total_fees_collected := v_total_fees_collected + v_fee_amount;
      v_total_net_payouts := v_total_net_payouts + v_net_payout;
      v_winners_count := v_winners_count + 1;
      
      -- Create notification for winner
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_contract.user_id,
        'MARKET_SETTLED',
        'Mercado Liquidado - Você Ganhou!',
        'Você ganhou R$ ' || ROUND(v_net_payout, 2) || ' no mercado: ' || v_market.title,
        jsonb_build_object(
          'market_id', p_market_id,
          'gross_payout', v_gross_payout,
          'fee_amount', v_fee_amount,
          'net_payout', v_net_payout,
          'position', v_contract.position
        )
      );
    ELSE
      -- Loser: just count
      v_losers_count := v_losers_count + 1;
      
      -- Create notification for loser
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_contract.user_id,
        'MARKET_SETTLED',
        'Mercado Liquidado',
        'O mercado "' || v_market.title || '" foi liquidado. Sua posição não venceu.',
        jsonb_build_object(
          'market_id', p_market_id,
          'position', v_contract.position,
          'winning_outcome', p_winning_outcome
        )
      );
    END IF;
  END LOOP;

  -- Record platform revenue with consistent type 'SETTLEMENT'
  IF v_total_fees_collected > 0 THEN
    INSERT INTO platform_revenue (day, type, gross, fees, net)
    VALUES (
      CURRENT_DATE, 
      'SETTLEMENT',
      v_total_gross_payouts, 
      v_total_fees_collected, 
      v_total_net_payouts
    )
    ON CONFLICT (day, type) DO UPDATE SET
      gross = platform_revenue.gross + EXCLUDED.gross,
      fees = platform_revenue.fees + EXCLUDED.fees,
      net = platform_revenue.net + EXCLUDED.net,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'market_id', p_market_id,
    'winning_outcome', p_winning_outcome,
    'winners_count', v_winners_count,
    'losers_count', v_losers_count,
    'total_gross_payouts', v_total_gross_payouts,
    'total_fees_collected', v_total_fees_collected,
    'total_net_payouts', v_total_net_payouts,
    'fee_percent_applied', v_fee_percent,
    'fee_snapshot_id', v_fee_snapshot_id
  );
END;
$function$;