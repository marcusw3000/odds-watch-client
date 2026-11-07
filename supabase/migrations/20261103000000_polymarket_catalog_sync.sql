-- Persistent cache for public Polymarket market data. This is intentionally
-- independent from the platform's LMSR `markets` table and BRL ledger.
CREATE TABLE IF NOT EXISTS public.polymarket_market_cache (
  source text NOT NULL DEFAULT 'polymarket' CHECK (source = 'polymarket'),
  market_id text NOT NULL,
  slug text,
  question text NOT NULL,
  description text,
  image_url text,
  condition_id text,
  protocol_version text,
  outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  volume_usd numeric,
  liquidity_usd numeric,
  spread numeric,
  end_date timestamptz,
  source_updated_at timestamptz,
  accepting_orders boolean NOT NULL DEFAULT false,
  restricted boolean NOT NULL DEFAULT false,
  source_payload jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, market_id)
);

CREATE INDEX IF NOT EXISTS polymarket_market_cache_synced_at_idx
  ON public.polymarket_market_cache (synced_at DESC);
CREATE INDEX IF NOT EXISTS polymarket_market_cache_end_date_idx
  ON public.polymarket_market_cache (end_date);

CREATE TABLE IF NOT EXISTS public.polymarket_catalog_sync_state (
  source text PRIMARY KEY CHECK (source = 'polymarket'),
  next_cursor text,
  cycle_started_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.polymarket_catalog_sync_state (source)
VALUES ('polymarket')
ON CONFLICT (source) DO NOTHING;

ALTER TABLE public.polymarket_market_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polymarket_catalog_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cached Polymarket markets"
  ON public.polymarket_market_cache FOR SELECT
  USING (true);

-- All writes remain service-role-only. No INSERT, UPDATE, or DELETE RLS policies
-- are created for either table. The cron is deliberately created in a later
-- migration, after its Edge Function has been deployed.
