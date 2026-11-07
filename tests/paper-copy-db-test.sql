\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.assert_true(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',msg; END IF; END $$;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
INSERT INTO public.profiles VALUES ('22222222-2222-4222-8222-222222222222',true,true),('33333333-3333-4333-8333-333333333333',false,false);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.save_paper_copy_strategy('paper','22222222-2222-4222-8222-222222222222','Trader','manual',100,10) AS strategy \gset
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.paper_copy_strategies),'owner cannot read strategy');
RESET ROLE;
SELECT public.create_paper_copy_signal(:'strategy','paper:trade1','123','Example','Yes',0.4,20,now()) AS signal \gset
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.notifications),'notification missing');
SELECT public.create_paper_copy_signal(:'strategy','paper:trade1','123','Example','Yes',0.4,20,now());
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.paper_copy_signals),'duplicate signal');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.paper_copy_strategies),'RLS disclosed strategy');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.paper_copy_signals),'RLS disclosed signals');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
SELECT public.respond_paper_copy_signal(:'signal',true);
RESET ROLE;
DO $$ BEGIN
  BEGIN PERFORM public.execute_paper_copy_signal((SELECT id FROM public.paper_copy_signals WHERE source_key='paper:trade1'),'12345',0.5,20); RAISE EXCEPTION 'price cap failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='price cap failed' THEN RAISE; END IF; END;
  BEGIN PERFORM public.execute_paper_copy_signal((SELECT id FROM public.paper_copy_signals WHERE source_key='paper:trade1'),'12345',0.4,100); RAISE EXCEPTION 'budget cap failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='budget cap failed' THEN RAISE; END IF; END;
END $$;
SELECT public.execute_paper_copy_signal(:'signal','12345',0.4,20);
SELECT public.execute_paper_copy_signal(:'signal','12345',0.4,20);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.polymarket_paper_trades),'repeated execution created duplicate trade');
SELECT pg_temp.assert_true((SELECT spent_usd=8 FROM public.paper_copy_strategies WHERE id=:'strategy'),'spent incorrect');
SELECT pg_temp.assert_true((SELECT shares=20 AND cost_usd=8 FROM public.paper_copy_positions WHERE strategy_id=:'strategy'),'copy position incorrect');
SELECT public.create_paper_copy_sale_signal(:'strategy','paper:sell1','123','Example','Yes',0.6,6,now(),10,20) AS sale \gset
SET ROLE authenticated;
SELECT public.respond_paper_copy_signal(:'sale',true);
RESET ROLE;
DO $$ BEGIN
  BEGIN PERFORM public.execute_paper_copy_signal((SELECT id FROM public.paper_copy_signals WHERE source_key='paper:sell1'),'12345',0.6,11); RAISE EXCEPTION 'sale fraction cap failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='sale fraction cap failed' THEN RAISE; END IF; END;
  BEGIN PERFORM public.execute_paper_copy_signal((SELECT id FROM public.paper_copy_signals WHERE source_key='paper:sell1'),'12345',0.5,10); RAISE EXCEPTION 'sale price cap failed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='sale price cap failed' THEN RAISE; END IF; END;
END $$;
SELECT public.execute_paper_copy_signal(:'sale','12345',0.6,10);
SELECT public.execute_paper_copy_signal(:'sale','12345',0.6,10);
SELECT pg_temp.assert_true((SELECT shares=10 AND cost_usd=4 AND realized_usd=2 FROM public.paper_copy_positions WHERE strategy_id=:'strategy'),'sale attribution incorrect');
SELECT public.execute_verified_paper_trade('11111111-1111-4111-8111-111111111111',gen_random_uuid(),(SELECT round_id FROM public.polymarket_paper_wallets WHERE user_id='11111111-1111-4111-8111-111111111111'),'123','Example','Yes','12345','SELL',5,0.6);
SELECT pg_temp.assert_true((SELECT shares=5 AND cost_usd=2 AND realized_usd=3 FROM public.paper_copy_positions WHERE strategy_id=:'strategy'),'manual sale attribution incorrect');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','public.execute_paper_copy_signal(uuid,text,numeric,numeric)','EXECUTE'),'client can execute without validated quote');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','public.create_paper_copy_signal(uuid,text,text,text,text,numeric,numeric,timestamp with time zone)','EXECUTE'),'client can forge signals');
SET ROLE authenticated;
SELECT public.save_paper_copy_strategy('polymarket','0x1234567890123456789012345678901234567890','Trader externo','automatic',100,10) AS automatic_strategy \gset
RESET ROLE;
SELECT public.create_paper_copy_signal(:'automatic_strategy','poly:one','123','Example','Yes',0.4,20,now()) AS automatic_signal \gset
SELECT pg_temp.assert_true((SELECT status='approved' FROM public.paper_copy_signals WHERE id=:'automatic_signal'),'automatic signal requires manual approval');
SET ROLE authenticated;
SELECT public.save_paper_copy_strategy('polymarket','0x1234567890123456789012345678901234567890','Trader externo','manual',100,10);
RESET ROLE;
SELECT pg_temp.assert_true((SELECT status='skipped' FROM public.paper_copy_signals WHERE id=:'automatic_signal'),'mode change did not cancel an old automatic signal');
SELECT public.create_paper_copy_signal(:'strategy','paper:trade2','123','Example','Yes',0.4,20,now()) AS signal2 \gset
SET ROLE authenticated;
SELECT public.respond_paper_copy_signal(:'signal2',true);
RESET ROLE;
UPDATE public.polymarket_paper_wallets SET round_id=gen_random_uuid() WHERE user_id='11111111-1111-4111-8111-111111111111';
SELECT pg_temp.assert_true((SELECT NOT active FROM public.paper_copy_strategies WHERE id=:'strategy'),'reset did not pause strategy');
SELECT pg_temp.assert_true((SELECT status='skipped' FROM public.paper_copy_signals WHERE id=:'signal2'),'reset did not cancel signal');
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM public.set_paper_copy_active((SELECT id FROM public.paper_copy_strategies WHERE source_kind='paper'),true); RAISE EXCEPTION 'reset allowed resume';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='reset allowed resume' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN PERFORM public.execute_paper_copy_signal((SELECT id FROM public.paper_copy_signals WHERE source_key='paper:trade2'),'12345',0.4,20); RAISE EXCEPTION 'reset failed to block copy';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='reset failed to block copy' THEN RAISE; END IF; END;
END $$;
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.polymarket_paper_trades),'reset created a trade');
SELECT 'paper copy database tests passed' AS result;
