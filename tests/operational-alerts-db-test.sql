\set ON_ERROR_STOP on
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA cron;
CREATE TABLE cron.job(jobid bigint, active boolean, jobname text);
CREATE TABLE cron.job_run_details(jobid bigint, status text, start_time timestamptz);
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE TYPE public.notification_type AS ENUM ('SYSTEM_ANNOUNCEMENT');
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE TABLE public.notifications(user_id uuid, type public.notification_type, title text, message text, data jsonb);
CREATE TABLE public.polymarket_catalog_sync_state(source text, last_error text);
CREATE TABLE public.paper_copy_strategies(active boolean, checked_at timestamptz);
CREATE TABLE public.paper_portfolio_snapshot_state(checked_at timestamptz, last_success_at timestamptz);
\i /migration.sql
INSERT INTO public.user_roles VALUES ('11111111-1111-4111-8111-111111111111','admin');
INSERT INTO public.polymarket_catalog_sync_state VALUES ('polymarket','error');
SELECT public.check_operational_alerts();
SELECT public.check_operational_alerts();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.notifications) <> 1 THEN RAISE EXCEPTION 'duplicate or missing alert'; END IF;
  IF has_function_privilege('authenticated','public.check_operational_alerts()','execute') OR has_table_privilege('authenticated','public.operational_alert_state','select') THEN RAISE EXCEPTION 'permissions too broad'; END IF;
END $$;
UPDATE public.polymarket_catalog_sync_state SET last_error = NULL;
SELECT public.check_operational_alerts();
UPDATE public.polymarket_catalog_sync_state SET last_error = 'again';
SELECT public.check_operational_alerts();
DO $$ BEGIN IF (SELECT count(*) FROM public.notifications) <> 2 THEN RAISE EXCEPTION 'recovery was not detected'; END IF; END $$;
