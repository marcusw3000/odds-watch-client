-- Execute after the migration and Edge Function are deployed, and after disk
-- writes have recovered. The existing full catalog sync remains paused.
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='polymarket_project_url')
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='polymarket_cron_secret') THEN
    RAISE EXCEPTION 'Missing Polymarket cron Vault secrets';
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='check-polymarket-closures';
  PERFORM cron.schedule('check-polymarket-closures','*/5 * * * *', $request$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='polymarket_project_url') || '/functions/v1/check-polymarket-closures',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='polymarket_cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  $request$);
END $cron$;
