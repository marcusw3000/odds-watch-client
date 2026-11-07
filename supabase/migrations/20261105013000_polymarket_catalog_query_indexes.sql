-- Index the persistent catalog's filter and pagination order. Existing data
-- remains intact; the original public read-only RLS policies still apply.
CREATE INDEX IF NOT EXISTS polymarket_cache_status_volume_page_idx
  ON public.polymarket_market_cache (source, market_status, volume_usd DESC NULLS LAST, market_id);

CREATE INDEX IF NOT EXISTS polymarket_cache_status_end_page_idx
  ON public.polymarket_market_cache (source, market_status, end_date ASC NULLS LAST, market_id);

CREATE INDEX IF NOT EXISTS polymarket_cache_status_updated_page_idx
  ON public.polymarket_market_cache (source, market_status, source_updated_at DESC NULLS LAST, market_id);

CREATE INDEX IF NOT EXISTS polymarket_event_status_volume_page_idx
  ON public.polymarket_event_cache (source, event_status, volume_usd DESC NULLS LAST, event_id);

CREATE INDEX IF NOT EXISTS polymarket_event_status_end_page_idx
  ON public.polymarket_event_cache (source, event_status, end_date ASC NULLS LAST, event_id);

CREATE INDEX IF NOT EXISTS polymarket_event_status_updated_page_idx
  ON public.polymarket_event_cache (source, event_status, source_updated_at DESC NULLS LAST, event_id);
