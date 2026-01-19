-- Fix process_market_payouts to update winning_trades, total_profit, and roi_percent
CREATE OR REPLACE FUNCTION public.process_market_payouts(
  p_market_id uuid,
  p_winning_outcome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_wallet RECORD;
  v_payout numeric;
  v_profit numeric;
  v_total_payouts numeric := 0;
  v_winner_count integer := 0;
BEGIN
  -- For each winning contract in this market
  FOR v_contract IN 
    SELECT uc.id, uc.user_id, uc.shares, uc.position, uc.total_invested
    FROM user_contracts uc
    WHERE uc.market_id = p_market_id 
      AND uc.position = p_winning_outcome
      AND uc.shares > 0
  LOOP
    -- Get user wallet
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_contract.user_id FOR UPDATE;
    
    IF v_wallet IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Calculate payout (1 BRL per share for winning contracts)
    v_payout := v_contract.shares;
    
    -- Calculate profit (payout - what was invested)
    v_profit := v_payout - COALESCE(v_contract.total_invested, 0);
    
    -- Credit user wallet
    UPDATE wallets SET
      balance_available = balance_available + v_payout,
      updated_at = now()
    WHERE id = v_wallet.id;
    
    -- Create ledger entry
    INSERT INTO ledger_entries (
      user_id, wallet_id, amount, net_amount, direction,
      ref_type, ref_id, status, description
    ) VALUES (
      v_contract.user_id, v_wallet.id, v_payout, v_payout, 'CREDIT',
      'SETTLEMENT', p_market_id, 'COMPLETED',
      'Ganho - Mercado liquidado'
    );
    
    -- Create PAYOUT transaction
    INSERT INTO transactions (
      user_id, market_id, type, position, shares,
      total_amount, price_per_share
    ) VALUES (
      v_contract.user_id, p_market_id, 'PAYOUT', v_contract.position,
      v_contract.shares, v_payout, 1
    );
    
    -- Update user profile statistics for leaderboard
    UPDATE profiles SET
      winning_trades = COALESCE(winning_trades, 0) + 1,
      total_profit = COALESCE(total_profit, 0) + v_profit,
      roi_percent = CASE 
        WHEN COALESCE(total_volume, 0) > 0 
        THEN ((COALESCE(total_profit, 0) + v_profit) / total_volume) * 100 
        ELSE 0 
      END,
      updated_at = now()
    WHERE id = v_contract.user_id;
    
    -- Check and grant achievements
    PERFORM check_and_grant_achievements(v_contract.user_id);
    
    v_total_payouts := v_total_payouts + v_payout;
    v_winner_count := v_winner_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'winners', v_winner_count,
    'total_payouts', v_total_payouts
  );
END;
$function$;