-- Disposable database only. All fixtures are rolled back.
BEGIN;
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000000091','closure91@example.test'), ('00000000-0000-4000-8000-000000000092','closure92@example.test');
INSERT INTO public.polymarket_favorites(user_id,source,market_id) VALUES
 ('00000000-0000-4000-8000-000000000091','polymarket','99999999999999999991'),
 ('00000000-0000-4000-8000-000000000092','polymarket','99999999999999999991');
INSERT INTO public.notification_preferences(user_id,in_app_market_updates) VALUES ('00000000-0000-4000-8000-000000000092',false)
 ON CONFLICT (user_id) DO UPDATE SET in_app_market_updates=false;
DO $$
BEGIN
 IF public.polymarket_record_closure_checks(ARRAY['99999999999999999991'],ARRAY['99999999999999999991']) <> 1 THEN RAISE EXCEPTION 'expected one notification'; END IF;
 IF public.polymarket_record_closure_checks(ARRAY['99999999999999999991'],ARRAY['99999999999999999991']) <> 0 THEN RAISE EXCEPTION 'duplicate notification'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id='00000000-0000-4000-8000-000000000091' AND data->>'source'='polymarket' AND data->>'market_id'='99999999999999999991') THEN RAISE EXCEPTION 'missing notification'; END IF;
 IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id='00000000-0000-4000-8000-000000000092') THEN RAISE EXCEPTION 'ignored preferences'; END IF;
 IF has_function_privilege('authenticated','public.polymarket_record_closure_checks(text[],text[])','EXECUTE') THEN RAISE EXCEPTION 'client can forge closure'; END IF;
 IF has_column_privilege('authenticated','public.profiles','total_profit','UPDATE') THEN RAISE EXCEPTION 'client can edit stats'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notifications WHERE data->>'market_id'='99999999999999999991') <> 1 THEN RAISE EXCEPTION 'own notification not visible'; END IF;
 UPDATE public.notifications SET is_read=true WHERE data->>'market_id'='99999999999999999991';
 UPDATE public.profiles SET display_name='Teste' WHERE id=auth.uid();
END $$;
ROLLBACK;
