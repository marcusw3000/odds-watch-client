-- Apply only after the authenticated snapshot function is deployed.
DO $setup$
BEGIN
  IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL OR to_regnamespace('vault') IS NULL THEN RAISE EXCEPTION 'pg_cron, pg_net and Vault are required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='paper_copy_gateway_jwt') OR NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='paper_copy_worker_secret') OR NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='polymarket_project_url') THEN RAISE EXCEPTION 'Missing scheduler secrets'; END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='snapshot-paper-portfolio';
  PERFORM cron.schedule('snapshot-paper-portfolio','*/5 * * * *',$request$
    SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='polymarket_project_url') || '/functions/v1/snapshot-paper-portfolio',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='paper_copy_gateway_jwt'),'x-copy-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='paper_copy_worker_secret')),
      body := '{}'::jsonb) WHERE EXISTS(SELECT 1 FROM public.paper_snapshot_candidates());
  $request$);
END $setup$;
