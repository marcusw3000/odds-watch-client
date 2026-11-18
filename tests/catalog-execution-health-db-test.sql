\set ON_ERROR_STOP on
\i /base-test.sql
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 = '11111111-1111-4111-8111-111111111111'::uuid $$;
ALTER TABLE cron.job_run_details ADD COLUMN end_time timestamptz;
\i /catalog-health.sql
TRUNCATE public.polymarket_catalog_sync_state,cron.job,cron.job_run_details;
INSERT INTO public.polymarket_catalog_sync_state VALUES ('polymarket','Gamma timeout');
INSERT INTO cron.job VALUES (42,true,'sync-polymarket-catalog');
INSERT INTO cron.job_run_details VALUES (42,'succeeded','2026-01-01 00:00:00+00','2026-01-01 00:00:01+00');
SELECT set_config('test.user','11111111-1111-4111-8111-111111111111',false);
DO $$ BEGIN
 IF public.get_admin_catalog_execution_health()->>'error_kind' <> 'gamma' THEN RAISE EXCEPTION 'classification failed'; END IF;
 IF (public.get_admin_catalog_execution_health()->>'last_cron_duration_ms')::numeric <> 1000 THEN RAISE EXCEPTION 'duration failed'; END IF;
 IF has_function_privilege('anon','public.get_admin_catalog_execution_health()','execute') THEN RAISE EXCEPTION 'anon has execute'; END IF;
END $$;
