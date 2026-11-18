CREATE OR REPLACE FUNCTION public.get_admin_catalog_execution_health() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'error_kind', (SELECT CASE WHEN last_error IS NULL THEN NULL WHEN last_error ILIKE '%gamma%' THEN 'gamma' ELSE 'other_or_unknown' END FROM public.polymarket_catalog_sync_state WHERE source='polymarket'),
    'last_market_cycle_duration_ms', (SELECT last_market_cycle_duration_ms FROM public.polymarket_catalog_sync_state WHERE source='polymarket'),
    'last_event_cycle_duration_ms', (SELECT last_event_cycle_duration_ms FROM public.polymarket_catalog_sync_state WHERE source='polymarket'),
    'last_cron_duration_ms', (SELECT extract(epoch FROM (r.end_time-r.start_time))*1000 FROM cron.job j JOIN cron.job_run_details r ON r.jobid=j.jobid WHERE j.jobname='sync-polymarket-catalog' AND r.end_time IS NOT NULL ORDER BY r.start_time DESC LIMIT 1)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_catalog_execution_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_catalog_execution_health() TO authenticated;
NOTIFY pgrst, 'reload schema';
