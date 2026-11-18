\set ON_ERROR_STOP on
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth; CREATE SCHEMA net; CREATE SCHEMA vault; CREATE SCHEMA cron;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user', true),'')::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 = '11111111-1111-4111-8111-111111111111'::uuid $$;
CREATE TABLE vault.decrypted_secrets(name text, decrypted_secret text);
INSERT INTO vault.decrypted_secrets VALUES ('polymarket_project_url','https://example.test'),('paper_copy_gateway_jwt','test'),('paper_copy_worker_secret','test');
CREATE SEQUENCE net.request_seq;
CREATE FUNCTION net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint LANGUAGE sql AS $$ SELECT nextval('net.request_seq') $$;
CREATE TABLE net._http_response(id bigint, status_code integer, error_msg text);
CREATE TABLE cron.job(jobid bigint, jobname text, command text);
INSERT INTO cron.job VALUES (1,'process-paper-copy','original'),(2,'snapshot-paper-portfolio','original');
CREATE FUNCTION cron.alter_job(bigint,command text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN UPDATE cron.job SET command=$2 WHERE jobid=$1; END $$;
\i /migration.sql
SELECT public.enqueue_operational_http('process-paper-copy');
INSERT INTO net._http_response VALUES (1,503,null);
SELECT set_config('test.user','11111111-1111-4111-8111-111111111111',false);
DO $$ BEGIN
  IF public.get_admin_http_health()->0->>'status' <> 'failed' THEN RAISE EXCEPTION 'HTTP failure not detected'; END IF;
  IF (SELECT count(*) FROM cron.job WHERE command LIKE '%enqueue_operational_http%') <> 2 THEN RAISE EXCEPTION 'jobs not updated'; END IF;
  IF has_function_privilege('authenticated','public.enqueue_operational_http(text)','execute') OR has_table_privilege('authenticated','public.operational_http_requests','select') THEN RAISE EXCEPTION 'permissions too broad'; END IF;
END $$;
