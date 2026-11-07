-- Disposable test database; all fixtures and changes are rolled back.
BEGIN;
ALTER TABLE cron.job ADD COLUMN IF NOT EXISTS schedule text;
CREATE TABLE IF NOT EXISTS cron.job_run_details (jobid bigint, status text, start_time timestamptz);
CREATE TABLE IF NOT EXISTS public.paper_referral_links (referred_id uuid PRIMARY KEY, referrer_id uuid NOT NULL);
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000081','admin81@example.test'),('00000000-0000-4000-8000-000000000082','user82@example.test');
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.wallets WHERE user_id IN ('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000082')) THEN RAISE EXCEPTION 'Legacy wallet created for new account'; END IF; END $$;
INSERT INTO public.user_roles(user_id,role) VALUES ('00000000-0000-4000-8000-000000000081','admin');
INSERT INTO public.support_tickets(id,user_id,subject) VALUES ('00000000-0000-4000-8000-000000000083','00000000-0000-4000-8000-000000000082','Teste');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000082',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM public.get_admin_catalog_health(); RAISE EXCEPTION 'Non-admin accessed health'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Forbidden' THEN RAISE; END IF; END;
  BEGIN PERFORM public.get_admin_user_paper_referrals(auth.uid()); RAISE EXCEPTION 'Non-admin accessed referrals'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Forbidden' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.support_messages(ticket_id,sender_id,message,is_staff) VALUES ('00000000-0000-4000-8000-000000000083',auth.uid(),'spoof',true); RAISE EXCEPTION 'Non-admin spoofed staff'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.support_messages(ticket_id,sender_id,message,is_staff) VALUES ('00000000-0000-4000-8000-000000000083',auth.uid(),'teste',false);
  IF (SELECT count(*) FROM public.admin_audit_logs) <> 0 THEN RAISE EXCEPTION 'Audit logs exposed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000081',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.get_admin_catalog_health()->>'market_count' IS NULL THEN RAISE EXCEPTION 'Missing health data'; END IF;
  IF (public.get_admin_user_paper_referrals('00000000-0000-4000-8000-000000000082')->>'total')::integer <> 0 THEN RAISE EXCEPTION 'Unexpected referrals'; END IF;
END $$;
ROLLBACK;
