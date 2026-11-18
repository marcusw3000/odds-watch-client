-- Extend the existing deduplicated alert check with HTTP outcomes.
CREATE OR REPLACE FUNCTION public.check_operational_alerts() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE item record; previous public.operational_alert_state; recipients integer;
BEGIN
  -- Avoid duplicate notifications when scheduled invocations overlap.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('operational-alerts-v1', 0)) THEN RETURN; END IF;
  SELECT count(DISTINCT user_id) INTO recipients FROM public.user_roles WHERE role = 'admin';
  FOR item IN
    SELECT * FROM (VALUES
      ('catalog_error', EXISTS (SELECT 1 FROM public.polymarket_catalog_sync_state WHERE source = 'polymarket' AND last_error IS NOT NULL), 'A sincronização do catálogo registrou erro.'),
      ('copy_lag', EXISTS (SELECT 1 FROM public.paper_copy_strategies WHERE active AND checked_at < now() - interval '15 minutes'), 'Há estratégias de Copy Trading sem verificação há mais de 15 minutos.'),
      ('snapshot_attempt', EXISTS (SELECT 1 FROM public.paper_portfolio_snapshot_state WHERE checked_at < now() - interval '15 minutes' AND (last_success_at IS NULL OR checked_at > last_success_at)), 'Há tentativas de coleta do portfólio sem sucesso posterior há mais de 15 minutos.'),
      ('http_failure', EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (q.job_name) q.job_name, q.requested_at, r.id, r.status_code, r.error_msg FROM public.operational_http_requests q JOIN cron.job j ON j.jobname = q.job_name AND j.active LEFT JOIN net._http_response r ON r.id = q.request_id WHERE q.requested_at >= now() - interval '6 hours' ORDER BY q.job_name, q.requested_at DESC) latest WHERE (id IS NULL AND requested_at < now() - interval '2 minutes') OR (id IS NOT NULL AND (error_msg IS NOT NULL OR status_code IS NULL OR status_code < 200 OR status_code >= 300))), 'Uma chamada HTTP operacional falhou ou não recebeu resposta.'),
      ('cron_failure', EXISTS (SELECT 1 FROM cron.job j JOIN LATERAL (SELECT status FROM cron.job_run_details WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1) r ON true WHERE j.active AND j.jobname IN ('sync-polymarket-catalog','check-polymarket-closures','process-paper-copy','snapshot-paper-portfolio') AND r.status = 'failed'), 'Um agendamento operacional registrou falha.')
    ) AS alerts(key, triggered, message)
  LOOP
    SELECT * INTO previous FROM public.operational_alert_state WHERE alert_key = item.key FOR UPDATE;
    IF item.triggered AND recipients > 0 AND (NOT coalesce(previous.active, false) OR previous.last_sent_at IS NULL OR previous.last_sent_at < now() - interval '6 hours') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      SELECT DISTINCT user_id, 'SYSTEM_ANNOUNCEMENT'::public.notification_type, 'Alerta operacional', item.message, jsonb_build_object('url', '/admin/system', 'alert_key', item.key)
      FROM public.user_roles WHERE role = 'admin';
      INSERT INTO public.operational_alert_state(alert_key, active, last_sent_at, checked_at) VALUES(item.key, true, now(), now())
      ON CONFLICT (alert_key) DO UPDATE SET active = true, last_sent_at = now(), checked_at = now();
    ELSE
      INSERT INTO public.operational_alert_state(alert_key, active, checked_at) VALUES(item.key, item.triggered, now())
      ON CONFLICT (alert_key) DO UPDATE SET active = item.triggered, checked_at = now();
    END IF;
  END LOOP;
END $$;
