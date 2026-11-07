-- Public, read-only Polymarket event catalogue. IDs stay provider-owned text.
CREATE TABLE IF NOT EXISTS public.polymarket_event_cache (
  source text NOT NULL DEFAULT 'polymarket' CHECK (source = 'polymarket'),
  event_id text NOT NULL,
  slug text,
  title text NOT NULL,
  search_text text NOT NULL DEFAULT '',
  description text,
  image_url text,
  volume_usd numeric,
  volume_24h_usd numeric,
  liquidity_usd numeric,
  end_date timestamptz,
  source_updated_at timestamptz,
  event_status text NOT NULL DEFAULT 'open' CHECK (event_status IN ('open', 'closed')),
  tags text[] NOT NULL DEFAULT '{}',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, event_id)
);
CREATE INDEX IF NOT EXISTS polymarket_event_tags_idx ON public.polymarket_event_cache USING gin (tags);
CREATE INDEX IF NOT EXISTS polymarket_event_status_volume_idx ON public.polymarket_event_cache (source, event_status, volume_24h_usd DESC NULLS LAST, event_id);
CREATE INDEX IF NOT EXISTS polymarket_event_slug_idx ON public.polymarket_event_cache (source, slug);
ALTER TABLE public.polymarket_event_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read cached Polymarket events" ON public.polymarket_event_cache FOR SELECT USING (true);
GRANT SELECT ON public.polymarket_event_cache TO anon, authenticated;

ALTER TABLE public.polymarket_market_cache ADD COLUMN IF NOT EXISTS event_id text;
ALTER TABLE public.polymarket_market_cache ADD CONSTRAINT polymarket_market_event_fk
  FOREIGN KEY (source, event_id) REFERENCES public.polymarket_event_cache (source, event_id);
CREATE INDEX IF NOT EXISTS polymarket_market_event_idx ON public.polymarket_market_cache (source, event_id, market_id);

ALTER TABLE public.polymarket_catalog_sync_state ADD COLUMN IF NOT EXISTS event_next_cursor text;
ALTER TABLE public.polymarket_catalog_sync_state ADD COLUMN IF NOT EXISTS event_cycle_started_at timestamptz;
