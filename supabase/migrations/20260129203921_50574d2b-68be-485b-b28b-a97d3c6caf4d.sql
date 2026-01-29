-- Drop and recreate process_market_payouts with correct enum value
DROP FUNCTION IF EXISTS public.process_market_payouts(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.process_market_payouts(
  p_market_id UUID,
  p_winning_outcome TEXT
)
RETURNS TABLE(
  user_id UUID,
  payout_amount NUMERIC,
  shares_settled NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_payout NUMERIC;
  v_is_multi_option BOOLEAN := FALSE;
  v_winning_option_id UUID := NULL;
BEGIN
  -- Detect if this is a multi-option market (UUID outcome) or binary (YES/NO)
  IF p_winning_outcome ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    v_is_multi_option := TRUE;
    v_winning_option_id := p_winning_outcome::UUID;
  END IF;

  IF v_is_multi_option THEN
    -- ========== MULTI-OPTION MARKET LOGIC ==========
    
    -- Process YES winners (contracts where option_id matches winning option)
    FOR v_contract IN 
      SELECT uc.id, uc.user_id, uc.shares, uc.option_id, uc.contract_type
      FROM user_contracts uc
      WHERE uc.market_id = p_market_id 
        AND uc.shares > 0
        AND uc.option_id = v_winning_option_id
        AND (uc.contract_type = 'YES' OR uc.contract_type IS NULL)
    LOOP
      v_payout := v_contract.shares * 1.0;
      
      -- Credit wallet
      INSERT INTO wallets (user_id, balance_available, balance_locked)
      VALUES (v_contract.user_id, v_payout, 0)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        balance_available = wallets.balance_available + v_payout,
        updated_at = now();
      
      -- Create ledger entry
      INSERT INTO ledger_entries (user_id, wallet_id, amount, net_amount, fee_amount, direction, ref_type, ref_id, status, meta)
      SELECT 
        v_contract.user_id,
        w.id,
        v_payout,
        v_payout,
        0,
        'CREDIT',
        'SETTLEMENT',
        p_market_id::TEXT,
        'COMPLETED',
        jsonb_build_object('contract_id', v_contract.id, 'outcome', 'WIN', 'contract_type', COALESCE(v_contract.contract_type, 'YES'))
      FROM wallets w WHERE w.user_id = v_contract.user_id;
      
      -- Update profile stats
      UPDATE profiles SET
        winning_trades = winning_trades + 1,
        total_profit = total_profit + v_payout,
        current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        best_trade_profit = GREATEST(best_trade_profit, v_payout),
        updated_at = now()
      WHERE id = v_contract.user_id;
      
      -- Send notification (FIXED: using uppercase enum value)
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_contract.user_id,
        'MARKET_SETTLED',
        'Mercado Encerrado - Você Ganhou!',
        format('Você ganhou R$ %.2f no mercado!', v_payout),
        jsonb_build_object('market_id', p_market_id, 'payout', v_payout, 'outcome', 'WIN')
      );
      
      -- Zero out shares
      UPDATE user_contracts SET shares = 0, updated_at = now() WHERE id = v_contract.id;
      
      -- Return result
      user_id := v_contract.user_id;
      payout_amount := v_payout;
      shares_settled := v_contract.shares;
      RETURN NEXT;
    END LOOP;
    
    -- Process NO winners (contracts where option_id does NOT match winning option)
    FOR v_contract IN 
      SELECT uc.id, uc.user_id, uc.shares, uc.option_id, uc.contract_type
      FROM user_contracts uc
      WHERE uc.market_id = p_market_id 
        AND uc.shares > 0
        AND uc.contract_type = 'NO'
        AND uc.option_id != v_winning_option_id
    LOOP
      v_payout := v_contract.shares * 1.0;
      
      -- Credit wallet
      INSERT INTO wallets (user_id, balance_available, balance_locked)
      VALUES (v_contract.user_id, v_payout, 0)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        balance_available = wallets.balance_available + v_payout,
        updated_at = now();
      
      -- Create ledger entry
      INSERT INTO ledger_entries (user_id, wallet_id, amount, net_amount, fee_amount, direction, ref_type, ref_id, status, meta)
      SELECT 
        v_contract.user_id,
        w.id,
        v_payout,
        v_payout,
        0,
        'CREDIT',
        'SETTLEMENT',
        p_market_id::TEXT,
        'COMPLETED',
        jsonb_build_object('contract_id', v_contract.id, 'outcome', 'WIN', 'contract_type', 'NO')
      FROM wallets w WHERE w.user_id = v_contract.user_id;
      
      -- Update profile stats
      UPDATE profiles SET
        winning_trades = winning_trades + 1,
        total_profit = total_profit + v_payout,
        current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        best_trade_profit = GREATEST(best_trade_profit, v_payout),
        updated_at = now()
      WHERE id = v_contract.user_id;
      
      -- Send notification (FIXED: using uppercase enum value)
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_contract.user_id,
        'MARKET_SETTLED',
        'Mercado Encerrado - Você Ganhou!',
        format('Você ganhou R$ %.2f no mercado!', v_payout),
        jsonb_build_object('market_id', p_market_id, 'payout', v_payout, 'outcome', 'WIN')
      );
      
      -- Zero out shares
      UPDATE user_contracts SET shares = 0, updated_at = now() WHERE id = v_contract.id;
      
      -- Return result
      user_id := v_contract.user_id;
      payout_amount := v_payout;
      shares_settled := v_contract.shares;
      RETURN NEXT;
    END LOOP;
    
    -- Reset streak for losers (YES contracts on losing options + NO contracts on winning option)
    UPDATE profiles SET current_streak = 0, updated_at = now()
    WHERE id IN (
      SELECT uc.user_id FROM user_contracts uc
      WHERE uc.market_id = p_market_id 
        AND uc.shares > 0
        AND (
          (uc.option_id != v_winning_option_id AND (uc.contract_type = 'YES' OR uc.contract_type IS NULL))
          OR
          (uc.option_id = v_winning_option_id AND uc.contract_type = 'NO')
        )
    );
    
    -- Zero out remaining losing contracts
    UPDATE user_contracts SET shares = 0, updated_at = now()
    WHERE market_id = p_market_id AND shares > 0;
    
  ELSE
    -- ========== BINARY MARKET LOGIC ==========
    
    FOR v_contract IN 
      SELECT uc.id, uc.user_id, uc.shares, uc.position
      FROM user_contracts uc
      WHERE uc.market_id = p_market_id 
        AND uc.shares > 0
        AND uc.position = p_winning_outcome
    LOOP
      v_payout := v_contract.shares * 1.0;
      
      -- Credit wallet
      INSERT INTO wallets (user_id, balance_available, balance_locked)
      VALUES (v_contract.user_id, v_payout, 0)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        balance_available = wallets.balance_available + v_payout,
        updated_at = now();
      
      -- Create ledger entry
      INSERT INTO ledger_entries (user_id, wallet_id, amount, net_amount, fee_amount, direction, ref_type, ref_id, status, meta)
      SELECT 
        v_contract.user_id,
        w.id,
        v_payout,
        v_payout,
        0,
        'CREDIT',
        'SETTLEMENT',
        p_market_id::TEXT,
        'COMPLETED',
        jsonb_build_object('contract_id', v_contract.id, 'outcome', 'WIN', 'position', v_contract.position)
      FROM wallets w WHERE w.user_id = v_contract.user_id;
      
      -- Update profile stats
      UPDATE profiles SET
        winning_trades = winning_trades + 1,
        total_profit = total_profit + v_payout,
        current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        best_trade_profit = GREATEST(best_trade_profit, v_payout),
        updated_at = now()
      WHERE id = v_contract.user_id;
      
      -- Send notification (FIXED: using uppercase enum value)
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_contract.user_id,
        'MARKET_SETTLED',
        'Mercado Encerrado - Você Ganhou!',
        format('Você ganhou R$ %.2f no mercado!', v_payout),
        jsonb_build_object('market_id', p_market_id, 'payout', v_payout, 'outcome', 'WIN')
      );
      
      -- Zero out shares
      UPDATE user_contracts SET shares = 0, updated_at = now() WHERE id = v_contract.id;
      
      -- Return result
      user_id := v_contract.user_id;
      payout_amount := v_payout;
      shares_settled := v_contract.shares;
      RETURN NEXT;
    END LOOP;
    
    -- Reset streak for losers
    UPDATE profiles SET current_streak = 0, updated_at = now()
    WHERE id IN (
      SELECT uc.user_id FROM user_contracts uc
      WHERE uc.market_id = p_market_id 
        AND uc.shares > 0
        AND uc.position != p_winning_outcome
    );
    
    -- Zero out remaining losing contracts
    UPDATE user_contracts SET shares = 0, updated_at = now()
    WHERE market_id = p_market_id AND shares > 0;
  END IF;
  
  RETURN;
END;
$$;