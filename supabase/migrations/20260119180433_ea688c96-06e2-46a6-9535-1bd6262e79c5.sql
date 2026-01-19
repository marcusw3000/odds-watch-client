-- Fix process_market_payouts function: remove reference to non-existent 'description' column
-- Use 'meta' JSONB column instead for storing payout description

CREATE OR REPLACE FUNCTION process_market_payouts(
  p_market_id UUID,
  p_winning_outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market RECORD;
  v_contract RECORD;
  v_payout_amount DECIMAL(18,2);
  v_total_payouts DECIMAL(18,2) := 0;
  v_users_paid INT := 0;
  v_wallet_id UUID;
BEGIN
  -- Get market details
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;

  -- Process each winning contract
  FOR v_contract IN 
    SELECT uc.*, p.id as profile_id
    FROM user_contracts uc
    JOIN profiles p ON p.id = uc.user_id
    WHERE uc.market_id = p_market_id 
      AND uc.position = p_winning_outcome
      AND uc.shares > 0
  LOOP
    -- Calculate payout (shares * 1.00 since winning contracts pay out at full value)
    v_payout_amount := v_contract.shares;
    
    -- Get or create wallet
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
    
    IF v_wallet_id IS NULL THEN
      INSERT INTO wallets (user_id, balance, available_balance)
      VALUES (v_contract.user_id, 0, 0)
      RETURNING id INTO v_wallet_id;
    END IF;
    
    -- Update wallet balance
    UPDATE wallets 
    SET balance = balance + v_payout_amount,
        available_balance = available_balance + v_payout_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Create ledger entry (using meta instead of description)
    INSERT INTO ledger_entries (
      user_id,
      wallet_id,
      ref_type,
      ref_id,
      direction,
      amount,
      fee_amount,
      net_amount,
      status,
      meta
    ) VALUES (
      v_contract.user_id,
      v_wallet_id,
      'SETTLEMENT',
      p_market_id,
      'CREDIT',
      v_payout_amount,
      0,
      v_payout_amount,
      'COMPLETED',
      jsonb_build_object(
        'description', 'Ganho - Mercado liquidado',
        'market_id', p_market_id,
        'market_title', v_market.title,
        'position', p_winning_outcome,
        'shares', v_contract.shares
      )
    );
    
    -- Create transaction record
    INSERT INTO transactions (
      user_id,
      market_id,
      type,
      position,
      shares,
      price_per_share,
      total_amount,
      created_at
    ) VALUES (
      v_contract.user_id,
      p_market_id,
      'PAYOUT',
      p_winning_outcome,
      v_contract.shares,
      1.00,
      v_payout_amount,
      NOW()
    );
    
    -- Update user profile statistics
    UPDATE profiles
    SET 
      winning_trades = COALESCE(winning_trades, 0) + 1,
      total_profit = COALESCE(total_profit, 0) + (v_payout_amount - COALESCE(v_contract.total_invested, 0)),
      roi_percent = CASE 
        WHEN COALESCE(total_volume, 0) > 0 
        THEN ((COALESCE(total_profit, 0) + (v_payout_amount - COALESCE(v_contract.total_invested, 0))) / total_volume) * 100 
        ELSE 0 
      END,
      updated_at = NOW()
    WHERE id = v_contract.user_id;
    
    v_total_payouts := v_total_payouts + v_payout_amount;
    v_users_paid := v_users_paid + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_payouts', v_total_payouts,
    'users_paid', v_users_paid,
    'market_id', p_market_id,
    'winning_outcome', p_winning_outcome
  );
END;
$$;