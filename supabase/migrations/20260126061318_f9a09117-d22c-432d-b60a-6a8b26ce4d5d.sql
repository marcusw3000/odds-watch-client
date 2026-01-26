-- =============================================
-- FASE 1: Corrigir Função process_market_payouts
-- Esta função estava referenciando tabela 'contracts' que não existe
-- =============================================

CREATE OR REPLACE FUNCTION public.process_market_payouts(
  p_market_id uuid, 
  p_winning_outcome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contract RECORD;
  v_payout_amount NUMERIC;
  v_profit NUMERIC;
  v_wallet_id UUID;
  v_total_payouts NUMERIC := 0;
  v_winners_count INT := 0;
  v_losers_count INT := 0;
  v_is_uuid BOOLEAN;
  v_market_type TEXT;
BEGIN
  -- Verificar se o outcome é um UUID (para mercados multi-opção)
  v_is_uuid := p_winning_outcome ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  
  -- Buscar tipo do mercado
  SELECT market_type INTO v_market_type FROM markets WHERE id = p_market_id;
  
  -- ========== PROCESSAR VENCEDORES ==========
  IF v_is_uuid THEN
    -- Mercado multi-opção: vencedores são quem tem option_id = UUID vencedor
    FOR v_contract IN 
      SELECT uc.id, uc.user_id, uc.shares, uc.total_invested, uc.position, uc.option_id
      FROM user_contracts uc
      WHERE uc.market_id = p_market_id
        AND uc.shares > 0
        AND uc.option_id = p_winning_outcome::uuid
    LOOP
      v_payout_amount := v_contract.shares;
      v_profit := v_payout_amount - v_contract.total_invested;
      
      SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
      
      IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance_available, balance_reserved, currency)
        VALUES (v_contract.user_id, 0, 0, 'BRL')
        RETURNING id INTO v_wallet_id;
      END IF;
      
      -- Creditar wallet
      UPDATE wallets
      SET balance_available = balance_available + v_payout_amount,
          updated_at = NOW()
      WHERE id = v_wallet_id;
      
      -- Entrada no ledger (direction = CREDIT)
      INSERT INTO ledger_entries (
        user_id, wallet_id, amount, net_amount, direction,
        ref_type, status, meta
      ) VALUES (
        v_contract.user_id, v_wallet_id, v_payout_amount, v_payout_amount, 
        'CREDIT', 'SETTLEMENT', 'COMPLETED',
        jsonb_build_object(
          'market_id', p_market_id,
          'contract_id', v_contract.id,
          'option_id', v_contract.option_id,
          'profit', v_profit
        )
      );
      
      -- Zerar contrato vencedor
      UPDATE user_contracts
      SET shares = 0, updated_at = NOW()
      WHERE id = v_contract.id;
      
      -- Atualizar estatísticas do perfil
      UPDATE profiles
      SET 
        winning_trades = COALESCE(winning_trades, 0) + 1,
        total_profit = COALESCE(total_profit, 0) + v_profit,
        current_streak = COALESCE(current_streak, 0) + 1,
        best_streak = GREATEST(COALESCE(best_streak, 0), COALESCE(current_streak, 0) + 1),
        best_trade_profit = GREATEST(COALESCE(best_trade_profit, 0), v_profit),
        updated_at = NOW()
      WHERE id = v_contract.user_id;
      
      v_total_payouts := v_total_payouts + v_payout_amount;
      v_winners_count := v_winners_count + 1;
    END LOOP;
    
    -- Processar perdedores (outras opções)
    FOR v_contract IN 
      SELECT uc.id, uc.user_id
      FROM user_contracts uc
      WHERE uc.market_id = p_market_id
        AND uc.shares > 0
        AND (uc.option_id IS NULL OR uc.option_id != p_winning_outcome::uuid)
    LOOP
      UPDATE user_contracts
      SET shares = 0, updated_at = NOW()
      WHERE id = v_contract.id;
      
      UPDATE profiles
      SET current_streak = 0, updated_at = NOW()
      WHERE id = v_contract.user_id;
      
      v_losers_count := v_losers_count + 1;
    END LOOP;
    
  ELSE
    -- Mercado binário: vencedores são quem tem position = YES ou NO
    FOR v_contract IN 
      SELECT uc.id, uc.user_id, uc.shares, uc.total_invested, uc.position
      FROM user_contracts uc
      WHERE uc.market_id = p_market_id
        AND uc.shares > 0
        AND UPPER(uc.position) = UPPER(p_winning_outcome)
    LOOP
      v_payout_amount := v_contract.shares;
      v_profit := v_payout_amount - v_contract.total_invested;
      
      SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
      
      IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance_available, balance_reserved, currency)
        VALUES (v_contract.user_id, 0, 0, 'BRL')
        RETURNING id INTO v_wallet_id;
      END IF;
      
      UPDATE wallets
      SET balance_available = balance_available + v_payout_amount,
          updated_at = NOW()
      WHERE id = v_wallet_id;
      
      INSERT INTO ledger_entries (
        user_id, wallet_id, amount, net_amount, direction,
        ref_type, status, meta
      ) VALUES (
        v_contract.user_id, v_wallet_id, v_payout_amount, v_payout_amount, 
        'CREDIT', 'SETTLEMENT', 'COMPLETED',
        jsonb_build_object(
          'market_id', p_market_id,
          'contract_id', v_contract.id,
          'position', v_contract.position,
          'profit', v_profit
        )
      );
      
      UPDATE user_contracts
      SET shares = 0, updated_at = NOW()
      WHERE id = v_contract.id;
      
      UPDATE profiles
      SET 
        winning_trades = COALESCE(winning_trades, 0) + 1,
        total_profit = COALESCE(total_profit, 0) + v_profit,
        current_streak = COALESCE(current_streak, 0) + 1,
        best_streak = GREATEST(COALESCE(best_streak, 0), COALESCE(current_streak, 0) + 1),
        best_trade_profit = GREATEST(COALESCE(best_trade_profit, 0), v_profit),
        updated_at = NOW()
      WHERE id = v_contract.user_id;
      
      v_total_payouts := v_total_payouts + v_payout_amount;
      v_winners_count := v_winners_count + 1;
    END LOOP;
    
    -- Processar perdedores (posição oposta)
    FOR v_contract IN 
      SELECT uc.id, uc.user_id
      FROM user_contracts uc
      WHERE uc.market_id = p_market_id
        AND uc.shares > 0
        AND UPPER(uc.position) != UPPER(p_winning_outcome)
    LOOP
      UPDATE user_contracts
      SET shares = 0, updated_at = NOW()
      WHERE id = v_contract.id;
      
      UPDATE profiles
      SET current_streak = 0, updated_at = NOW()
      WHERE id = v_contract.user_id;
      
      v_losers_count := v_losers_count + 1;
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'market_type', v_market_type,
    'is_multi_option', v_is_uuid,
    'total_payouts', v_total_payouts,
    'winners_count', v_winners_count,
    'losers_count', v_losers_count
  );
END;
$$;

-- =============================================
-- FASE 2: Limpar contratos de mercados já liquidados
-- =============================================

UPDATE user_contracts
SET shares = 0, updated_at = NOW()
WHERE market_id IN (
  SELECT id FROM markets WHERE status = 'SETTLED'
)
AND shares > 0;

-- =============================================
-- FASE 3: Corrigir datas inconsistentes em mercados
-- =============================================

-- Mercado de teste ainda OPEN - ajustar settlement_date para depois do close_date
UPDATE markets
SET settlement_date = close_date + INTERVAL '1 day'
WHERE id = '3071daec-a21b-4eb5-9e2b-b52835d391ce'
  AND close_date > settlement_date;

-- Mercados SETTLED - ajustar close_date para antes do settlement_date
UPDATE markets
SET close_date = settlement_date - INTERVAL '1 day'
WHERE status = 'SETTLED'
  AND close_date > settlement_date;

-- =============================================
-- FASE 4: Criar ledger entries para wallets órfãs (auditoria)
-- Usando direction = 'CREDIT' conforme constraint
-- =============================================

INSERT INTO ledger_entries (user_id, wallet_id, amount, net_amount, direction, ref_type, status, meta)
SELECT 
  w.user_id,
  w.id,
  w.balance_available,
  w.balance_available,
  'CREDIT',
  'DEPOSIT',
  'COMPLETED',
  '{"description": "Saldo inicial - migração de dados", "migrated": true}'::jsonb
FROM wallets w
WHERE NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.user_id = w.user_id)
  AND w.balance_available > 0;