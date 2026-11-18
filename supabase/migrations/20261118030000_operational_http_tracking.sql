-- Capture only request IDs and statuses; never persist headers or response bodies.
CREATE TABLE public.operational_http_requests (
  request_id bigint PRIMARY KEY,
  job_name text NOT NULL CHECK (job_name IN ('process-paper-copy', 'snapshot-paper-portfolio')),
  requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operational_http_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX operational_http_requests_requested_at_idx ON public.operational_http_requests(requested_at);
REVOKE ALL ON public.operational_http_requests FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.enqueue_operational_http(p_job text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE request_id bigint; endpoint text;
BEGIN
  IF p_job NOT IN ('process-paper-copy', 'snapshot-paper-portfolio') THEN RAISE EXCEPTION 'Unsupported job'; END IF;
  endpoint := CASE p_job WHEN 'process-paper-copy' THEN '/functions/v1/process-paper-copy' ELSE '/functions/v1/snapshot-paper-portfolio' END;
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'polymarket_project_url') || endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'paper_copy_gateway_jwt'), 'x-copy-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'paper_copy_worker_secret')),
    body := '{}'::jsonb
  ) INTO request_id;
  INSERT INTO public.operational_http_requests(request_id, job_name) VALUES(request_id, p_job);
  DELETE FROM public.operational_http_requests WHERE requested_at < now() - interval '24 hours';
  RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_operational_http(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_operational_http(text) TO postgres;

CREATE FUNCTION public.get_admin_http_health() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT DISTINCT ON (q.job_name) q.job_name, q.requested_at, r.status_code,
      CASE WHEN r.id IS NULL AND q.requested_at < now() - interval '6 hours' THEN 'response_unavailable'
           WHEN r.id IS NULL AND q.requested_at < now() - interval '2 minutes' THEN 'no_response'
           WHEN r.id IS NULL THEN 'pending'
           WHEN r.error_msg IS NOT NULL OR r.status_code IS NULL OR r.status_code < 200 OR r.status_code >= 300 THEN 'failed'
           ELSE 'succeeded' END AS status
    FROM public.operational_http_requests q LEFT JOIN net._http_response r ON r.id = q.request_id
    ORDER BY q.job_name, q.requested_at DESC
  ) t), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_admin_http_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_http_health() TO authenticated;

-- Preserve each existing job's schedule and active state; change only its command.
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid, jobname FROM cron.job WHERE jobname IN ('process-paper-copy', 'snapshot-paper-portfolio') LOOP
    IF j.jobname = 'process-paper-copy' THEN
      PERFORM cron.alter_job(j.jobid, command := 'SELECT public.enqueue_operational_http(''process-paper-copy'') WHERE EXISTS (SELECT 1 FROM public.paper_copy_strategies WHERE active)');
    ELSE
      PERFORM cron.alter_job(j.jobid, command := 'SELECT public.enqueue_operational_http(''snapshot-paper-portfolio'') WHERE EXISTS (SELECT 1 FROM public.paper_snapshot_candidates())');
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
