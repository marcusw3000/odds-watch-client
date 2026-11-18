\set ON_ERROR_STOP on
\i /base-test.sql
CREATE SCHEMA net;
CREATE TABLE net._http_response(id bigint, status_code integer, error_msg text);
CREATE TABLE public.operational_http_requests(request_id bigint, job_name text, requested_at timestamptz);
\i /http-alerts.sql
TRUNCATE public.notifications, public.operational_alert_state, public.polymarket_catalog_sync_state;
INSERT INTO cron.job VALUES (10,true,'process-paper-copy');
INSERT INTO public.operational_http_requests VALUES (1,'process-paper-copy',now());
INSERT INTO net._http_response VALUES (1,503,NULL);
SELECT public.check_operational_alerts();
SELECT public.check_operational_alerts();
DO $$ BEGIN IF (SELECT count(*) FROM public.notifications WHERE data->>'alert_key'='http_failure') <> 1 THEN RAISE EXCEPTION 'failed response must generate one alert'; END IF; END $$;
UPDATE net._http_response SET status_code=200;
SELECT public.check_operational_alerts();
UPDATE net._http_response SET status_code=503;
SELECT public.check_operational_alerts();
DO $$ BEGIN IF (SELECT count(*) FROM public.notifications WHERE data->>'alert_key'='http_failure') <> 2 THEN RAISE EXCEPTION 'recurrence must create new alert'; END IF; END $$;
TRUNCATE net._http_response;
UPDATE public.operational_http_requests SET requested_at=now()-interval '3 minutes';
UPDATE public.operational_alert_state SET active=false WHERE alert_key='http_failure';
SELECT public.check_operational_alerts();
DO $$ BEGIN IF (SELECT count(*) FROM public.notifications WHERE data->>'alert_key'='http_failure') <> 3 THEN RAISE EXCEPTION 'missing response must generate alert'; END IF; END $$;
