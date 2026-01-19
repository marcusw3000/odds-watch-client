-- Atualizar process_market_payouts para incluir current_streak, best_streak e best_trade_profit
CREATE OR REPLACE FUNCTION public.process_market_payouts(p_market_id UUID, p_winning_outcome TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_payout_amount NUMERIC;
  v_profit NUMERIC;
  v_wallet_id UUID;
  v_total_payouts NUMERIC := 0;
  v_winners_count INT := 0;
  v_losers_count INT := 0;
BEGIN
  -- Loop through all winning contracts for this market
  FOR v_contract IN 
    SELECT c.*, c.quantity * 1 AS payout_per_share
    FROM contracts c
    WHERE c.market_id = p_market_id
      AND c.status = 'ACTIVE'
      AND UPPER(c.outcome) = UPPER(p_winning_outcome)
  LOOP
    v_payout_amount := v_contract.quantity; -- Each winning share pays 1 BRL
    v_profit := v_payout_amount - v_contract.cost_basis;
    
    -- Get or create wallet
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
    
    IF v_wallet_id IS NULL THEN
      INSERT INTO wallets (user_id, balance_available, balance_locked, currency)
      VALUES (v_contract.user_id, 0, 0, 'BRL')
      RETURNING id INTO v_wallet_id;
    END IF;
    
    -- Update wallet balance
    UPDATE wallets
    SET balance_available = balance_available + v_payout_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Create ledger entry
    INSERT INTO ledger_entries (
      user_id, wallet_id, amount, net_amount, direction,
      ref_type, status, meta
    ) VALUES (
      v_contract.user_id, v_wallet_id, v_payout_amount, v_payout_amount, 'CREDIT',
      'SETTLEMENT', 'COMPLETED',
      jsonb_build_object(
        'description', 'Pagamento de liquidação - Mercado vencedor',
        'market_id', p_market_id,
        'contract_id', v_contract.id,
        'profit', v_profit
      )
    );
    
    -- Update contract status
    UPDATE contracts
    SET status = 'SETTLED',
        settled_at = NOW()
    WHERE id = v_contract.id;
    
    -- Update user profile stats including streaks and best_trade_profit
    UPDATE profiles
    SET 
      winning_trades = COALESCE(winning_trades, 0) + 1,
      total_profit = COALESCE(total_profit, 0) + v_profit,
      roi_percent = CASE 
        WHEN COALESCE(total_volume, 0) > 0 
        THEN ((COALESCE(total_profit, 0) + v_profit) / total_volume) * 100 
        ELSE 0 
      END,
      current_streak = COALESCE(current_streak, 0) + 1,
      best_streak = GREATEST(COALESCE(best_streak, 0), COALESCE(current_streak, 0) + 1),
      best_trade_profit = GREATEST(COALESCE(best_trade_profit, 0), v_profit),
      updated_at = NOW()
    WHERE id = v_contract.user_id;
    
    v_total_payouts := v_total_payouts + v_payout_amount;
    v_winners_count := v_winners_count + 1;
  END LOOP;
  
  -- Process losing contracts: reset their current_streak
  FOR v_contract IN 
    SELECT c.*
    FROM contracts c
    WHERE c.market_id = p_market_id
      AND c.status = 'ACTIVE'
      AND UPPER(c.outcome) != UPPER(p_winning_outcome)
  LOOP
    -- Update contract status to SETTLED
    UPDATE contracts
    SET status = 'SETTLED',
        settled_at = NOW()
    WHERE id = v_contract.id;
    
    -- Reset current_streak for losers
    UPDATE profiles
    SET 
      current_streak = 0,
      updated_at = NOW()
    WHERE id = v_contract.user_id;
    
    v_losers_count := v_losers_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_payouts', v_total_payouts,
    'winners_count', v_winners_count,
    'losers_count', v_losers_count
  );
END;
$$;