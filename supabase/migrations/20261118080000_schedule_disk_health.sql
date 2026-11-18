DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL OR to_regnamespace('vault') IS NULL THEN RAISE EXCEPTION 'Scheduler extensions unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='polymarket_project_url') OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='paper_copy_gateway_jwt') OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name='paper_copy_worker_secret') THEN RAISE EXCEPTION 'Scheduler secrets unavailable'; END IF;
  PERFORM cron.schedule('check-disk-health','*/10 * * * *',$request$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='polymarket_project_url') || '/functions/v1/check-disk-health',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='paper_copy_gateway_jwt'),'x-copy-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='paper_copy_worker_secret')),
      body := '{}'::jsonb
    )
  $request$);
END $$;
