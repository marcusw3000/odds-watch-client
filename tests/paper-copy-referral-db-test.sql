\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.check_value(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
INSERT INTO auth.users(id) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.paper_referral_codes(owner_id,code) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','AAAAAAAAAAAA');
INSERT INTO public.paper_referral_links(referred_id,referrer_id) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.polymarket_paper_wallets(user_id) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
SELECT round_id AS round FROM public.polymarket_paper_wallets WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' \gset
INSERT INTO public.paper_copy_strategies(user_id,source_kind,source_id,source_name,round_id,mode,total_limit,per_trade_limit) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','polymarket','0x123','Trader',:'round','automatic',1000,1000) RETURNING id AS strategy \gset
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),:'round','123','Example','Yes','12345','BUY',100,0.4);
INSERT INTO public.paper_copy_positions(strategy_id,round_id,market_id,outcome,shares,cost_usd) VALUES (:'strategy',:'round','123','Yes',100,40);
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'round','123','Example','Yes','12345','SELL',10,0.6);
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'round','123','Example','Yes','12345','SELL',10,0.6);
SELECT pg_temp.check_value((SELECT count(*)=1 AND sum(commission_usd)=0.2 FROM public.paper_copy_referral_commissions),'first commission or idempotency incorrect');
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),:'round','123','Example','Yes','12345','SELL',10,0.2);
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),:'round','123','Example','Yes','12345','SELL',10,0.6);
SELECT pg_temp.check_value((SELECT count(*)=1 FROM public.paper_copy_referral_commissions),'commission charged during loss recovery');
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),:'round','123','Example','Yes','12345','SELL',10,0.7);
SELECT pg_temp.check_value((SELECT count(*)=2 AND sum(commission_usd)=0.5 FROM public.paper_copy_referral_commissions),'high water commission incorrect');
SELECT pg_temp.check_value((SELECT balance_usd=9980.5 FROM public.polymarket_paper_wallets WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'referred balance incorrect');
SELECT pg_temp.check_value((SELECT balance_usd=10000.5 FROM public.polymarket_paper_wallets WHERE user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'referrer balance incorrect');
SELECT pg_temp.check_value((SELECT realized_profit=5 FROM public.polymarket_paper_ranking_stats WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'ranking changed by commission');
-- A non-copy trade never generates referral commission.
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),:'round','456','Other','Yes','54321','BUY',10,0.4);
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),:'round','456','Other','Yes','54321','SELL',10,0.8);
SELECT pg_temp.check_value((SELECT count(*)=2 FROM public.paper_copy_referral_commissions),'ordinary sale generated commission');
-- Failure in the commission ledger must roll back the sale and wallet movements.
CREATE FUNCTION pg_temp.reject_commission() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test commission failure'; END $$;
CREATE TRIGGER reject_commission BEFORE INSERT ON public.paper_copy_referral_commissions FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_commission();
DO $$ DECLARE before_balance numeric; before_shares numeric; current_round uuid; BEGIN
  SELECT balance_usd,round_id INTO before_balance,current_round FROM public.polymarket_paper_wallets WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  SELECT shares INTO before_shares FROM public.polymarket_paper_positions WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND market_id='123';
  BEGIN
    PERFORM public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),current_round,'123','Example','Yes','12345','SELL',10,0.8);
    RAISE EXCEPTION 'expected failure did not occur';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'test commission failure' THEN RAISE; END IF; END;
  IF (SELECT balance_usd FROM public.polymarket_paper_wallets WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> before_balance OR (SELECT shares FROM public.polymarket_paper_positions WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND market_id='123') <> before_shares THEN RAISE EXCEPTION 'sale was not rolled back'; END IF;
END $$;
DROP TRIGGER reject_commission ON public.paper_copy_referral_commissions;
SELECT pg_temp.check_value(NOT has_table_privilege('authenticated','public.paper_copy_referral_commissions','SELECT'),'commission table exposed');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT pg_temp.check_value((public.get_my_paper_copy_referral_summary()->>'received_usd')::numeric=0.5,'referrer summary incorrect');
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
SELECT pg_temp.check_value((public.get_my_paper_copy_referral_summary()->>'received_usd')::numeric=0,'privacy violated');
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT public.reset_polymarket_paper_wallet();
SELECT pg_temp.check_value((public.get_my_paper_copy_referral_summary()->>'paid_current_round_usd')::numeric=0,'reset retained current round commission');
RESET ROLE;
SELECT pg_temp.check_value((SELECT count(*)=2 FROM public.paper_copy_referral_commissions),'reset deleted commission history');
-- After reset, two copied strategies and a direct position share one market.
SELECT round_id AS new_round FROM public.polymarket_paper_wallets WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' \gset
UPDATE public.paper_copy_strategies SET round_id=:'new_round' WHERE id=:'strategy';
INSERT INTO public.paper_copy_strategies(user_id,source_kind,source_id,source_name,round_id,mode,total_limit,per_trade_limit) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','paper','another','Other Trader',:'new_round','manual',1000,1000) RETURNING id AS strategy2 \gset
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),:'new_round','789','Mixed','Yes','98765','BUY',30,0.4);
INSERT INTO public.paper_copy_positions(strategy_id,round_id,market_id,outcome,shares,cost_usd) VALUES (:'strategy',:'new_round','789','Yes',10,4),(:'strategy2',:'new_round','789','Yes',10,4);
SELECT public.execute_verified_paper_trade('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),:'new_round','789','Mixed','Yes','98765','SELL',15,0.8);
SELECT pg_temp.check_value((SELECT count(*)=3 AND sum(commission_usd)=0.9 FROM public.paper_copy_referral_commissions),'mixed strategy commission incorrect');
SELECT pg_temp.check_value((SELECT jsonb_array_length(allocations)=2 AND gross_sale_profit_usd=4 FROM public.paper_copy_referral_commissions WHERE round_id=:'new_round'),'mixed allocations missing');
