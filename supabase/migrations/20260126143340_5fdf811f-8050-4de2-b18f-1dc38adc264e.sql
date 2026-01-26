-- Tabela para armazenar snapshots diários de volume
CREATE TABLE public.daily_volume_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  total_platform_volume NUMERIC NOT NULL DEFAULT 0,
  total_trades_count INTEGER NOT NULL DEFAULT 0,
  active_markets_count INTEGER NOT NULL DEFAULT 0,
  daily_volume NUMERIC NOT NULL DEFAULT 0,
  daily_trades_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para buscas rápidas por data
CREATE INDEX idx_daily_volume_snapshots_date 
ON daily_volume_snapshots(snapshot_date DESC);

-- RLS - apenas admins podem ler
ALTER TABLE public.daily_volume_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read snapshots"
ON public.daily_volume_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Service role pode inserir (edge functions)
CREATE POLICY "Service role can insert snapshots"
ON public.daily_volume_snapshots FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update snapshots"
ON public.daily_volume_snapshots FOR UPDATE
USING (true);