-- The catalog worker has a 45-second budget; pg_net defaults to only 5 seconds.
-- Keep the existing schedule and Vault secrets, but allow its response to finish.
DO $migration$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'sync-polymarket-catalog';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := v_job_id,
      command := $job$
        SELECT net.http_post(
          url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'polymarket_project_url') || '/functions/v1/sync-polymarket-catalog',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'polymarket_cron_secret')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 90000
        );
      $job$
    );
  END IF;
END
$migration$;
