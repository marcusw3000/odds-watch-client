-- Temporarily stop only the Polymarket catalog sync while disk is recovered.
BEGIN;
SET TRANSACTION READ WRITE;
DO $$
DECLARE selected_job bigint; matches integer;
BEGIN
  SELECT min(jobid), count(*) INTO selected_job, matches FROM cron.job WHERE jobname='sync-polymarket-catalog';
  IF matches <> 1 THEN RAISE EXCEPTION 'Expected exactly one Polymarket sync job'; END IF;
  PERFORM cron.alter_job(selected_job, active := false);
END $$;
COMMIT;
