-- Run only against an isolated migrated Supabase database. Everything is rolled back.
BEGIN;
DO $$
DECLARE u uuid := gen_random_uuid(); round_id uuid; buy_id uuid := gen_random_uuid(); sell_id uuid := gen_random_uuid();
  result jsonb; s public.polymarket_paper_ranking_stats; pos public.polymarket_paper_positions; b numeric;
BEGIN
  IF has_function_privilege('authenticated','public.execute_verified_paper_trade(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric)','EXECUTE')
     OR has_function_privilege('authenticated','public.execute_polymarket_paper_trade(text,text,text,text,text,numeric,numeric)','EXECUTE')
     OR has_table_privilege('authenticated','public.polymarket_paper_wallets','UPDATE') THEN RAISE EXCEPTION 'unsafe authenticated grant'; END IF;
  INSERT INTO auth.users(id) VALUES(u);
  INSERT INTO public.profiles(id,display_name,is_public,show_profit,show_roi,show_volume,show_trades)
    VALUES(u,'Paper test',true,true,false,true,true)
    ON CONFLICT(id) DO UPDATE SET display_name='Paper test',is_public=true,show_profit=true,show_roi=false,show_volume=true,show_trades=true;
  INSERT INTO public.polymarket_paper_wallets(user_id) VALUES(u) RETURNING polymarket_paper_wallets.round_id INTO round_id;
  INSERT INTO public.polymarket_paper_positions(user_id,market_id,market_question,outcome_label,outcome_token_id,shares,average_price,legacy_shares,legacy_cost,verified_cost)
    VALUES(u,'123','Test market','Yes','789',10,0.2,10,2,0);
  result := public.execute_verified_paper_trade(u,buy_id,round_id,'123','Test market','Yes','456','BUY',10,0.4);
  result := public.execute_verified_paper_trade(u,buy_id,round_id,'123','Test market','Yes','456','BUY',10,0.4);
  SELECT * INTO pos FROM public.polymarket_paper_positions WHERE user_id=u;
  IF pos.shares<>20 OR pos.legacy_shares<>10 OR pos.verified_cost<>4 OR pos.outcome_token_id<>'456' THEN RAISE EXCEPTION 'buy, legacy token or idempotency failed'; END IF;
  result := public.execute_verified_paper_trade(u,sell_id,round_id,'123','Test market','Yes','456','SELL',15,0.5);
  SELECT * INTO s FROM public.polymarket_paper_ranking_stats WHERE user_id=u;
  SELECT * INTO pos FROM public.polymarket_paper_positions WHERE user_id=u;
  SELECT balance_usd INTO b FROM public.polymarket_paper_wallets WHERE user_id=u;
  IF s.realized_profit<>0.5 OR s.realized_cost<>2 OR s.volume_usd<>6.5 OR s.trade_count<>2 OR s.winning_trades<>1
     OR pos.shares<>5 OR pos.legacy_shares<>0 OR pos.verified_cost<>2 OR b<>10003.5 THEN RAISE EXCEPTION 'legacy-first accounting failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_paper_leaderboard('profit',100) WHERE user_id=u AND roi_percent IS NULL AND total_profit=0.5) THEN RAISE EXCEPTION 'ranking privacy failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.get_paper_leaderboard('roi',100) WHERE user_id=u) THEN RAISE EXCEPTION 'hidden sort leaked'; END IF;
  UPDATE public.profiles SET is_public=false WHERE id=u;
  IF EXISTS (SELECT 1 FROM public.get_paper_leaderboard('profit',100) WHERE user_id=u) THEN RAISE EXCEPTION 'private profile leaked'; END IF;
  result := public.execute_verified_paper_trade(u,gen_random_uuid(),round_id,'123','Test market','Yes','456','SELL',5,0.3);
  SELECT * INTO s FROM public.polymarket_paper_ranking_stats WHERE user_id=u;
  IF s.realized_profit<>0 OR s.realized_cost<>4 OR s.volume_usd<>8 OR s.trade_count<>3 OR s.winning_trades<>1 THEN RAISE EXCEPTION 'realized loss failed'; END IF;
  BEGIN
    PERFORM public.execute_verified_paper_trade(u,gen_random_uuid(),round_id,'123','Test market','Yes','456','SELL',1,0.5);
    RAISE EXCEPTION 'insufficient shares accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Shares simuladas insuficientes%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.execute_verified_paper_trade(u,buy_id,round_id,'123','Test market','Yes','456','BUY',11,0.4);
    RAISE EXCEPTION 'mismatched idempotency accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Chave de operação%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM public.reset_polymarket_paper_wallet();
  IF EXISTS (SELECT 1 FROM public.polymarket_paper_ranking_stats WHERE user_id=u) OR EXISTS (SELECT 1 FROM public.polymarket_paper_positions WHERE user_id=u)
     OR (SELECT balance_usd FROM public.polymarket_paper_wallets WHERE user_id=u)<>10000 THEN RAISE EXCEPTION 'reset failed'; END IF;
  BEGIN
    PERFORM public.execute_verified_paper_trade(u,buy_id,round_id,'123','Test market','Yes','456','BUY',10,0.4);
    RAISE EXCEPTION 'stale request accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Carteira reiniciada%' THEN RAISE; END IF;
  END;
END $$;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.polymarket_paper_wallets) <> 1 THEN RAISE EXCEPTION 'wallet RLS failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.polymarket_paper_wallets WHERE user_id='f30fa7a3-40b1-4bf1-b0c4-7bf2482a4f41') THEN RAISE EXCEPTION 'other wallet leaked'; END IF;
  UPDATE public.profiles SET is_public=true, display_name='Paper test enabled' WHERE id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'profile preference update failed'; END IF;
  IF has_column_privilege('authenticated','public.profiles','total_profit','UPDATE') THEN RAISE EXCEPTION 'financial profile field is writable'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
