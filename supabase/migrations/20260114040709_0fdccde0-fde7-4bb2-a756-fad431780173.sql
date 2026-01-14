-- Fase 1: Migrar dados existentes de user_balances para wallets
-- Primeiro, inserir wallets para usuários que ainda não têm
INSERT INTO wallets (user_id, balance_available, balance_locked, currency)
SELECT user_id, balance, 0, 'BRL'
FROM user_balances
WHERE NOT EXISTS (
  SELECT 1 FROM wallets w WHERE w.user_id = user_balances.user_id
);

-- Atualizar wallets existentes com os valores de user_balances
UPDATE wallets
SET balance_available = ub.balance,
    updated_at = now()
FROM user_balances ub
WHERE wallets.user_id = ub.user_id;

-- Criar trigger para sincronizar user_balances -> wallets
CREATE OR REPLACE FUNCTION public.sync_user_balance_to_wallet()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir ou atualizar wallet correspondente
  INSERT INTO wallets (user_id, balance_available, balance_locked, currency)
  VALUES (NEW.user_id, NEW.balance, 0, 'BRL')
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance_available = NEW.balance,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para INSERT e UPDATE em user_balances
CREATE TRIGGER sync_balance_to_wallet
AFTER INSERT OR UPDATE ON user_balances
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_balance_to_wallet();

-- Adicionar constraint UNIQUE em wallets.user_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wallets_user_id_key' 
    AND conrelid = 'wallets'::regclass
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);
  END IF;
END $$;