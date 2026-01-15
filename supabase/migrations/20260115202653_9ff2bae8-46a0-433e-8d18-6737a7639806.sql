-- Verificar e adicionar colunas faltantes em wallets
ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS total_deposited NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC NOT NULL DEFAULT 0;