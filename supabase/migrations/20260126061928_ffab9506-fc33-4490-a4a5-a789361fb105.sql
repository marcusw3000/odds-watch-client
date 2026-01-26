-- Phase 3: Fix remaining integrity issues

-- 1. Fix transactions with negative amounts for BUY type
UPDATE transactions
SET total_amount = ABS(total_amount)
WHERE type = 'BUY' AND total_amount < 0;

-- 2. Recalculate total_volume for affected markets
UPDATE markets m
SET total_volume = sub.calculated_volume
FROM (
  SELECT market_id, COALESCE(SUM(ABS(total_amount)), 0) as calculated_volume
  FROM transactions
  WHERE type = 'BUY'
  GROUP BY market_id
) sub
WHERE m.id = sub.market_id
AND m.total_volume != sub.calculated_volume;

-- 3. Add constraint to prevent negative BUY transactions in the future
ALTER TABLE transactions 
ADD CONSTRAINT transactions_buy_positive 
CHECK (type != 'BUY' OR total_amount >= 0);

-- 4. Fix the process_market_payouts function - replace balance_reserved with balance_locked
CREATE OR REPLACE FUNCTION process_market_payouts(p_market_id UUID, p_winning_outcome TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_payout NUMERIC;
  v_total_payouts NUMERIC := 0;
  v_total_winners INTEGER := 0;
  v_contract_unit NUMERIC;
  v_is_uuid BOOLEAN;
  v_winning_option_id UUID;
BEGIN
  -- Get market contract unit cost
  SELECT contract_unit_cost INTO v_contract_unit
  FROM markets WHERE id = p_market_id;
  
  IF v_contract_unit IS NULL THEN
    RETURN jsonb_build_object('error', 'Market not found');
  END IF;

  -- Check if winning_outcome is a UUID (multi-option) or YES/NO (binary)
  v_is_uuid := p_winning_outcome ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  
  IF v_is_uuid THEN
    v_winning_option_id := p_winning_outcome::UUID;
  END IF;

  -- Process each contract with shares > 0
  FOR v_contract IN
    SELECT uc.id, uc.user_id, uc.position, uc.shares, uc.option_id, uc.average_price, uc.total_invested
    FROM user_contracts uc
    WHERE uc.market_id = p_market_id AND uc.shares > 0
  LOOP
    -- Determine if this is a winning position
    IF v_is_uuid THEN
      -- Multi-option: winner if option_id matches
      IF v_contract.option_id = v_winning_option_id THEN
        v_payout := v_contract.shares * v_contract_unit;
        v_total_winners := v_total_winners + 1;
      ELSE
        v_payout := 0;
      END IF;
    ELSE
      -- Binary: winner if position matches (YES/NO)
      IF UPPER(v_contract.position) = UPPER(p_winning_outcome) THEN
        v_payout := v_contract.shares * v_contract_unit;
        v_total_winners := v_total_winners + 1;
      ELSE
        v_payout := 0;
      END IF;
    END IF;

    -- Update wallet balance if there's a payout
    IF v_payout > 0 THEN
      v_total_payouts := v_total_payouts + v_payout;
      
      -- Update or create wallet
      INSERT INTO wallets (user_id, balance_available, balance_locked, currency)
      VALUES (v_contract.user_id, v_payout, 0, 'BRL')
      ON CONFLICT (user_id) DO UPDATE
      SET balance_available = wallets.balance_available + v_payout,
          updated_at = NOW();
      
      -- Create ledger entry for the payout
      INSERT INTO ledger_entries (
        user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
      )
      SELECT 
        v_contract.user_id,
        w.id,
        v_payout,
        v_payout,
        'CREDIT',
        'SETTLEMENT',
        p_market_id,
        'COMPLETED'
      FROM wallets w WHERE w.user_id = v_contract.user_id;

      -- Update profile stats for winner
      UPDATE profiles
      SET 
        winning_trades = winning_trades + 1,
        total_profit = total_profit + (v_payout - v_contract.total_invested),
        roi_percent = CASE 
          WHEN total_volume > 0 THEN ((total_profit + (v_payout - v_contract.total_invested)) / total_volume) * 100
          ELSE 0
        END,
        current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        best_trade_profit = GREATEST(best_trade_profit, v_payout - v_contract.total_invested),
        updated_at = NOW()
      WHERE id = v_contract.user_id;
    ELSE
      -- Loser: reset streak
      UPDATE profiles
      SET 
        current_streak = 0,
        updated_at = NOW()
      WHERE id = v_contract.user_id;
    END IF;

    -- Zero out shares in the contract
    UPDATE user_contracts
    SET shares = 0, updated_at = NOW()
    WHERE id = v_contract.id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_payouts', v_total_payouts,
    'total_winners', v_total_winners,
    'market_id', p_market_id,
    'winning_outcome', p_winning_outcome
  );
END;
$$;