-- Adicionar coluna de recorrência à tabela markets
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT 'none';

-- Adicionar coluna para ID do mercado pai (série)
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS parent_market_id UUID REFERENCES markets(id) ON DELETE SET NULL;

-- Index para buscar mercados da mesma série
CREATE INDEX IF NOT EXISTS idx_markets_parent_id ON markets(parent_market_id) WHERE parent_market_id IS NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN markets.recurrence_type IS 'Tipo de recorrência: none, weekly, monthly, quarterly, annually';
COMMENT ON COLUMN markets.parent_market_id IS 'ID do mercado original quando este é parte de uma série recorrente';