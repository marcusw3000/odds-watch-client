-- Drop and recreate process_market_payouts to support MULTIPLE markets (UUID outcomes)
DROP FUNCTION IF EXISTS public.process_market_payouts(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.process_market_payouts(
  p_market_id UUID,
  p_winning_outcome TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_total_payouts NUMERIC := 0;
  v_payout_count INT := 0;
  v_is_multi_option BOOLEAN := FALSE;
  v_winning_option_id UUID := NULL;
  v_market_type TEXT;
  v_payout_amount NUMERIC;
  v_ledger_id UUID;
  v_wallet_id UUID;
BEGIN
  -- Detect if this is a multi-option market (outcome is UUID)
  IF p_winning_outcome ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    v_is_multi_option := TRUE;
    v_winning_option_id := p_winning_outcome::UUID;
    RAISE NOTICE 'Multi-option market detected. Winning option: %', v_winning_option_id;
  ELSE
    RAISE NOTICE 'Binary market detected. Winning outcome: %', p_winning_outcome;
  END IF;

  -- Get market type for verification
  SELECT market_type INTO v_market_type FROM markets WHERE id = p_market_id;

  IF v_is_multi_option THEN
    -- MULTIPLE MARKET: Process contracts based on option_id and contract_type
    
    -- Process YES contracts on winning option (they win R$1 per share)
    FOR v_contract IN
      SELECT uc.*, p.id as profile_id
      FROM user_contracts uc
      JOIN profiles p ON p.id = uc.user_id
      WHERE uc.market_id = p_market_id
        AND uc.shares > 0
        AND uc.option_id = v_winning_option_id
        AND (uc.contract_type = 'YES' OR uc.contract_type IS NULL)
    LOOP
      v_payout_amount := v_contract.shares;
      
      SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
      IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance_available, balance_locked)
        VALUES (v_contract.user_id, 0, 0)
        RETURNING id INTO v_wallet_id;
      END IF;

      UPDATE wallets 
      SET balance_available = balance_available + v_payout_amount,
          updated_at = NOW()
      WHERE id = v_wallet_id;

      INSERT INTO ledger_entries (
        user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
      ) VALUES (
        v_contract.user_id, v_wallet_id, v_payout_amount, v_payout_amount, 
        'CREDIT', 'SETTLEMENT', p_market_id, 'COMPLETED'
      ) RETURNING id INTO v_ledger_id;

      UPDATE user_contracts SET shares = 0, updated_at = NOW() WHERE id = v_contract.id;

      UPDATE profiles 
      SET winning_trades = winning_trades + 1,
          total_profit = total_profit + v_payout_amount - v_contract.avg_price * v_contract.shares,
          current_streak = current_streak + 1,
          best_streak = GREATEST(best_streak, current_streak + 1),
          best_trade_profit = GREATEST(best_trade_profit, v_payout_amount - v_contract.avg_price * v_contract.shares),
          updated_at = NOW()
      WHERE id = v_contract.user_id;

      v_total_payouts := v_total_payouts + v_payout_amount;
      v_payout_count := v_payout_count + 1;

      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_contract.user_id,
        'market_settled',
        'Mercado Liquidado - Você Ganhou!',
        'Você recebeu R$ ' || ROUND(v_payout_amount, 2) || ' do mercado liquidado.',
        jsonb_build_object('market_id', p_market_id, 'payout', v_payout_amount)
      );
    END LOOP;

    -- Process NO contracts on NON-winning options (they win R$1 per share)
    FOR v_contract IN
      SELECT uc.*, p.id as profile_id
      FROM user_contracts uc
      JOIN profiles p ON p.id = uc.user_id
      WHERE uc.market_id = p_market_id
        AND uc.shares > 0
        AND uc.contract_type = 'NO'
        AND uc.option_id != v_winning_option_id
    LOOP
      v_payout_amount := v_contract.shares;
      
      SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
      IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance_available, balance_locked)
        VALUES (v_contract.user_id, 0, 0)
        RETURNING id INTO v_wallet_id;
      END IF;

      UPDATE wallets 
      SET balance_available = balance_available + v_payout_amount,
          updated_at = NOW()
      WHERE id = v_wallet_id;

      INSERT INTO ledger_entries (
        user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
      ) VALUES (
        v_contract.user_id, v_wallet_id, v_payout_amount, v_payout_amount, 
        'CREDIT', 'SETTLEMENT', p_market_id, 'COMPLETED'
      ) RETURNING id INTO v_ledger_id;

      UPDATE user_contracts SET shares = 0, updated_at = NOW() WHERE id = v_contract.id;

      UPDATE profiles 
      SET winning_trades = winning_trades + 1,
          total_profit = total_profit + v_payout_amount - v_contract.avg_price * v_contract.shares,
          current_streak = current_streak + 1,
          best_streak = GREATEST(best_streak, current_streak + 1),
          best_trade_profit = GREATEST(best_trade_profit, v_payout_amount - v_contract.avg_price * v_contract.shares),
          updated_at = NOW()
      WHERE id = v_contract.user_id;

      v_total_payouts := v_total_payouts + v_payout_amount;
      v_payout_count := v_payout_count + 1;

      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_contract.user_id,
        'market_settled',
        'Mercado Liquidado - Você Ganhou!',
        'Você recebeu R$ ' || ROUND(v_payout_amount, 2) || ' do mercado liquidado.',
        jsonb_build_object('market_id', p_market_id, 'payout', v_payout_amount)
      );
    END LOOP;

    -- Reset streak for losers and zero out contracts
    UPDATE profiles 
    SET current_streak = 0, updated_at = NOW()
    WHERE id IN (
      SELECT user_id FROM user_contracts 
      WHERE market_id = p_market_id AND shares > 0
        AND (
          ((contract_type = 'YES' OR contract_type IS NULL) AND option_id != v_winning_option_id)
          OR (contract_type = 'NO' AND option_id = v_winning_option_id)
        )
    );

    UPDATE user_contracts 
    SET shares = 0, updated_at = NOW()
    WHERE market_id = p_market_id AND shares > 0
      AND (
        ((contract_type = 'YES' OR contract_type IS NULL) AND option_id != v_winning_option_id)
        OR (contract_type = 'NO' AND option_id = v_winning_option_id)
      );

  ELSE
    -- BINARY MARKET: Use position field (YES/NO)
    FOR v_contract IN
      SELECT uc.*, p.id as profile_id
      FROM user_contracts uc
      JOIN profiles p ON p.id = uc.user_id
      WHERE uc.market_id = p_market_id
        AND uc.shares > 0
        AND UPPER(uc.position) = UPPER(p_winning_outcome)
    LOOP
      v_payout_amount := v_contract.shares;
      
      SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
      IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance_available, balance_locked)
        VALUES (v_contract.user_id, 0, 0)
        RETURNING id INTO v_wallet_id;
      END IF;

      UPDATE wallets 
      SET balance_available = balance_available + v_payout_amount,
          updated_at = NOW()
      WHERE id = v_wallet_id;

      INSERT INTO ledger_entries (
        user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
      ) VALUES (
        v_contract.user_id, v_wallet_id, v_payout_amount, v_payout_amount, 
        'CREDIT', 'SETTLEMENT', p_market_id, 'COMPLETED'
      ) RETURNING id INTO v_ledger_id;

      UPDATE user_contracts SET shares = 0, updated_at = NOW() WHERE id = v_contract.id;

      UPDATE profiles 
      SET winning_trades = winning_trades + 1,
          total_profit = total_profit + v_payout_amount - v_contract.avg_price * v_contract.shares,
          current_streak = current_streak + 1,
          best_streak = GREATEST(best_streak, current_streak + 1),
          best_trade_profit = GREATEST(best_trade_profit, v_payout_amount - v_contract.avg_price * v_contract.shares),
          updated_at = NOW()
      WHERE id = v_contract.user_id;

      v_total_payouts := v_total_payouts + v_payout_amount;
      v_payout_count := v_payout_count + 1;

      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_contract.user_id,
        'market_settled',
        'Mercado Liquidado - Você Ganhou!',
        'Você recebeu R$ ' || ROUND(v_payout_amount, 2) || ' do mercado liquidado.',
        jsonb_build_object('market_id', p_market_id, 'payout', v_payout_amount)
      );
    END LOOP;

    UPDATE profiles 
    SET current_streak = 0, updated_at = NOW()
    WHERE id IN (
      SELECT user_id FROM user_contracts 
      WHERE market_id = p_market_id AND shares > 0
        AND UPPER(position) != UPPER(p_winning_outcome)
    );

    UPDATE user_contracts 
    SET shares = 0, updated_at = NOW()
    WHERE market_id = p_market_id AND shares > 0
      AND UPPER(position) != UPPER(p_winning_outcome);
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'market_id', p_market_id,
    'winning_outcome', p_winning_outcome,
    'is_multi_option', v_is_multi_option,
    'total_payouts', v_total_payouts,
    'payout_count', v_payout_count
  );
END;
$$;