-- Aggregated diagnostics only; no user identifiers or provider error details.
CREATE OR REPLACE FUNCTION public.get_admin_operational_health() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'market_cache_bytes', pg_total_relation_size('public.polymarket_market_cache'),
    'catalog_last_success', (SELECT last_success_at FROM public.polymarket_catalog_sync_state WHERE source = 'polymarket'),
    'catalog_error', coalesce((SELECT last_error IS NOT NULL FROM public.polymarket_catalog_sync_state WHERE source = 'polymarket'), false),
    'copy_oldest_check', (SELECT min(checked_at) FROM public.paper_copy_strategies WHERE active),
    'copy_active', (SELECT count(*) FROM public.paper_copy_strategies WHERE active),
    'copy_pending', (SELECT count(*) FROM public.paper_copy_signals WHERE status = 'pending'),
    'snapshot_last_success', (SELECT max(last_success_at) FROM public.paper_portfolio_snapshot_state),
    'snapshot_failed_attempts', (SELECT count(*) FROM public.paper_portfolio_snapshot_state WHERE checked_at IS NOT NULL AND (last_success_at IS NULL OR checked_at > last_success_at)),
    'jobs', coalesce((SELECT jsonb_agg(jsonb_build_object('name', j.jobname, 'active', j.active, 'schedule', j.schedule,
      'last_status', (SELECT r.status FROM cron.job_run_details r WHERE r.jobid = j.jobid ORDER BY r.start_time DESC LIMIT 1),
      'last_run', (SELECT r.start_time FROM cron.job_run_details r WHERE r.jobid = j.jobid ORDER BY r.start_time DESC LIMIT 1)))
      FROM cron.job j WHERE j.jobname IN ('process-paper-copy', 'snapshot-paper-portfolio')), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.get_admin_operational_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_operational_health() TO authenticated;
NOTIFY pgrst, 'reload schema';
