-- Apply this only after `sync-polymarket-catalog` is deployed.
-- Fresh projects may not have pg_cron/pg_net enabled yet.
DO $cron$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL AND to_regnamespace('net') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'sync-polymarket-catalog';

    PERFORM cron.schedule(
      'sync-polymarket-catalog',
      '*/5 * * * *',
      $request$
      SELECT net.http_post(
        url := 'https://tztqsorbugjhwljbiano.supabase.co/functions/v1/sync-polymarket-catalog',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
      $request$
    );
  END IF;
END;
$cron$;
