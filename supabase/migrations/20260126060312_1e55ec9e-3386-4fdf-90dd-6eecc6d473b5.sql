-- =============================================
-- FASE 1: Correção de Constraints de Result
-- =============================================

-- 1.1 Remover constraint atual de markets.result (se existir)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'markets_result_check'
  ) THEN
    ALTER TABLE markets DROP CONSTRAINT markets_result_check;
  END IF;
END $$;

-- 1.2 Adicionar nova constraint que aceita YES, NO ou UUID válido
ALTER TABLE markets ADD CONSTRAINT markets_result_check 
  CHECK (
    result IS NULL 
    OR result IN ('YES', 'NO') 
    OR (length(result) = 36 AND result ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );

-- 1.3 Remover constraint atual de market_settlements.result (se existir)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'market_settlements_result_check'
  ) THEN
    ALTER TABLE market_settlements DROP CONSTRAINT market_settlements_result_check;
  END IF;
END $$;

-- 1.4 Adicionar nova constraint para market_settlements
ALTER TABLE market_settlements ADD CONSTRAINT market_settlements_result_check 
  CHECK (
    result IN ('YES', 'NO') 
    OR (length(result) = 36 AND result ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );

-- =============================================
-- FASE 2: Recalcular shares das opções (sem filtro de status)
-- =============================================

UPDATE market_options mo
SET shares = COALESCE((
  SELECT SUM(uc.shares)
  FROM user_contracts uc
  WHERE uc.option_id = mo.id
), 0)
WHERE mo.market_id = '260e14e8-7b45-42fc-948a-e5100876d712';

-- =============================================
-- FASE 3: Constraints Preventivas
-- =============================================

-- 3.1 Corrigir contratos existentes com position errado
UPDATE user_contracts
SET position = 'OPTION'
WHERE option_id IS NOT NULL AND position IN ('YES', 'NO');

-- 3.2 Adicionar constraint em user_contracts
ALTER TABLE user_contracts DROP CONSTRAINT IF EXISTS user_contracts_multi_option_check;
ALTER TABLE user_contracts ADD CONSTRAINT user_contracts_multi_option_check
  CHECK (
    (position IN ('YES', 'NO') AND option_id IS NULL)
    OR (position = 'OPTION' AND option_id IS NOT NULL)
  );

-- 3.3 Corrigir transações existentes com position errado
UPDATE transactions
SET position = 'OPTION'
WHERE option_id IS NOT NULL AND position IN ('YES', 'NO');

-- 3.4 Adicionar constraint em transactions
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_multi_option_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_multi_option_check
  CHECK (
    (position IN ('YES', 'NO') AND option_id IS NULL)
    OR (position = 'OPTION' AND option_id IS NOT NULL)
  );