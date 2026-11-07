\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.assert_true(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',msg; END IF; END $$;
INSERT INTO auth.users(id) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.polymarket_paper_wallets(user_id) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SELECT round_id,updated_at FROM public.polymarket_paper_wallets WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' \gset
SELECT public.save_paper_portfolio_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'round_id',:'updated_at',6,2);
SELECT public.save_paper_portfolio_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'round_id',:'updated_at',7,3);
SELECT pg_temp.assert_true((SELECT count(*)=1 AND max(open_pnl)=3 FROM public.paper_portfolio_snapshots),'hourly upsert failed');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.paper_portfolio_snapshots),'owner cannot read');
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.paper_portfolio_snapshots),'snapshot privacy failed');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','public.save_paper_portfolio_snapshot(uuid,uuid,timestamp with time zone,numeric,numeric)','EXECUTE'),'client can forge snapshot');
RESET ROLE;
UPDATE public.polymarket_paper_wallets SET updated_at=updated_at+interval '1 second' WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$ BEGIN
  BEGIN PERFORM public.save_paper_portfolio_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(SELECT round_id FROM public.polymarket_paper_wallets WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),(SELECT updated_at-interval '1 second' FROM public.polymarket_paper_wallets WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),100,100); RAISE EXCEPTION 'stale snapshot accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='stale snapshot accepted' THEN RAISE; END IF; END;
END $$;
SELECT pg_temp.assert_true((SELECT max(open_pnl)=3 FROM public.paper_portfolio_snapshots),'stale snapshot modified history');
SELECT pg_temp.assert_true((SELECT round_id FROM public.paper_portfolio_snapshot_state WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')=:'round_id'::uuid,'snapshot round missing');
SELECT 'paper history database tests passed' AS result;
