-- The catalog's freshness timestamps are public; sync cursors, leases, staged
-- data and errors remain private. Column grants are needed by security_invoker.
REVOKE SELECT ON public.polymarket_catalog_sync_state FROM PUBLIC, anon, authenticated;
GRANT SELECT (source, cycle_started_at, last_cycle_completed_at, last_success_at,
  updated_at, event_cycle_started_at, event_last_cycle_completed_at)
  ON public.polymarket_catalog_sync_state TO anon, authenticated;
DROP POLICY IF EXISTS "Public can read Polymarket sync timestamps" ON public.polymarket_catalog_sync_state;
CREATE POLICY "Public can read Polymarket sync timestamps"
  ON public.polymarket_catalog_sync_state FOR SELECT TO anon, authenticated
  USING (source = 'polymarket');
ALTER VIEW public.polymarket_catalog_sync_public SET (security_invoker = true);
NOTIFY pgrst, 'reload schema';
