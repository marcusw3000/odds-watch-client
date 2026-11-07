-- RLS defines row access, but fresh projects also need table privileges.
-- Keep cache reads public while restricting sync state and all writes to
-- the service role used by the catalog synchronization function.
GRANT SELECT ON public.polymarket_market_cache TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polymarket_catalog_sync_state TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.polymarket_market_cache TO service_role;
