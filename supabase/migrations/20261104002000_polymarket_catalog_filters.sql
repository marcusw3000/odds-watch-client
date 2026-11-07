ALTER TABLE public.polymarket_market_cache
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS market_status text NOT NULL DEFAULT 'open' CHECK (market_status IN ('open', 'closed'));
CREATE INDEX IF NOT EXISTS polymarket_market_cache_filters_idx
  ON public.polymarket_market_cache (source, market_status, category, end_date);
