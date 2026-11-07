-- Run on a disposable migrated database only; all changes are rolled back.
BEGIN;
INSERT INTO auth.users(id,created_at) VALUES
  ('00000000-0000-4000-8000-000000000001',now()),
  ('00000000-0000-4000-8000-000000000002',now()),
  ('00000000-0000-4000-8000-000000000003',now()),
  ('00000000-0000-4000-8000-000000000004',now()-interval '8 days'),
  ('00000000-0000-4000-8000-000000000005',now());
INSERT INTO public.polymarket_paper_trades(user_id,market_id,outcome_label,side,price,shares,notional_usd)
  VALUES('00000000-0000-4000-8000-000000000005','1','Yes','BUY',0.5,1,0.5);
DO $$ BEGIN
  IF has_table_privilege('authenticated','public.paper_referral_links','SELECT')
     OR has_table_privilege('authenticated','public.paper_referral_links','INSERT')
     OR has_function_privilege('anon','public.apply_paper_referral(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.process_referral_commission(uuid,numeric,numeric,uuid)','EXECUTE')
     OR NOT has_table_privilege('service_role','public.paper_referral_links','SELECT')
     OR NOT has_table_privilege('service_role','public.paper_referral_codes','SELECT')
     OR NOT has_table_privilege('service_role','public.polymarket_event_comments','SELECT')
     OR NOT has_table_privilege('service_role','public.polymarket_paper_trades','SELECT')
     OR NOT has_table_privilege('service_role','public.audit_logs','SELECT')
     OR NOT has_table_privilege('service_role','public.audit_logs','INSERT')
  THEN RAISE EXCEPTION 'unsafe grants'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE test_code AS SELECT public.get_my_paper_referral_code() AS code;
DO $$ BEGIN
  IF (SELECT code FROM test_code) <> public.get_my_paper_referral_code() THEN RAISE EXCEPTION 'code not stable'; END IF;
  IF public.apply_paper_referral((SELECT code FROM test_code)) <> 'own_code' THEN RAISE EXCEPTION 'self referral accepted'; END IF;
  BEGIN PERFORM public.get_paper_referral_admin_stats(); RAISE EXCEPTION 'non-admin saw admin stats';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Forbidden' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
  IF public.apply_paper_referral(lower((SELECT code FROM test_code))) <> 'applied' THEN RAISE EXCEPTION 'first referral failed'; END IF;
  IF public.apply_paper_referral((SELECT code FROM test_code)) <> 'already_linked' THEN RAISE EXCEPTION 'idempotency failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN IF public.apply_paper_referral((SELECT code FROM test_code)) <> 'applied' THEN RAISE EXCEPTION 'code not reusable'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN IF public.apply_paper_referral((SELECT code FROM test_code)) <> 'ineligible' THEN RAISE EXCEPTION 'old account accepted'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
DO $$ BEGIN IF public.apply_paper_referral((SELECT code FROM test_code)) <> 'ineligible' THEN RAISE EXCEPTION 'past trade accepted'; END IF; END $$;
RESET ROLE;
INSERT INTO public.polymarket_paper_ranking_stats(user_id,trade_count) VALUES('00000000-0000-4000-8000-000000000002',2);
INSERT INTO public.user_roles(user_id,role) VALUES('00000000-0000-4000-8000-000000000003','admin');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.get_my_paper_referral_stats();
  IF s.total_referred<>2 OR s.active_referred<>1 OR s.verified_trades<>2 THEN RAISE EXCEPTION 'incorrect referral metrics'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.get_paper_referral_admin_stats();
  IF s.total_codes<>1 OR s.total_referred<>2 OR s.active_referred<>1 OR s.verified_trades<>2 THEN RAISE EXCEPTION 'incorrect admin metrics'; END IF;
END $$;
RESET ROLE;
DELETE FROM public.polymarket_paper_ranking_stats WHERE user_id='00000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s record; BEGIN
  SELECT * INTO s FROM public.get_my_paper_referral_stats();
  IF s.total_referred<>2 OR s.active_referred<>0 OR s.verified_trades<>0 THEN RAISE EXCEPTION 'reset metrics incorrect'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
