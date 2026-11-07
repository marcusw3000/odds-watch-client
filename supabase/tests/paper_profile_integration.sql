-- Run only against an isolated migrated database. Changes are rolled back.
BEGIN;
DO $$
DECLARE u uuid := gen_random_uuid(); r uuid := gen_random_uuid(); first_sale uuid := gen_random_uuid(); second_sale uuid := gen_random_uuid(); profile jsonb;
BEGIN
  INSERT INTO auth.users(id) VALUES(u);
  INSERT INTO public.profiles(id,display_name,is_public,show_profit,show_roi,show_volume,show_trades)
    VALUES(u,'Profile test',true,true,true,true,true)
    ON CONFLICT(id) DO UPDATE SET is_public=true,show_profit=true,show_roi=true,show_volume=true,show_trades=true;
  INSERT INTO public.polymarket_paper_wallets(user_id,round_id) VALUES(u,r);
  PERFORM public.execute_verified_paper_trade(u,gen_random_uuid(),r,'123','Test','Yes','123','BUY',10,0.4);
  PERFORM public.execute_verified_paper_trade(u,first_sale,r,'123','Test','Yes','123','SELL',5,0.6);
  PERFORM public.execute_verified_paper_trade(u,second_sale,r,'123','Test','Yes','123','SELL',5,0.2);
  UPDATE public.polymarket_paper_requests SET created_at = now() - interval '1 second' WHERE user_id=u AND request_id=first_sale;
  profile := public.get_paper_profile(u);
  IF (profile->>'sales_count')::integer <> 2 OR (profile->>'winning_sales')::integer <> 1
    OR (profile->>'best_trade_profit')::numeric <> 1 OR (profile->>'current_streak')::integer <> 0
    OR (profile->>'best_streak')::integer <> 1 OR jsonb_array_length(profile->'history') <> 3
    OR (profile->>'total_profit')::numeric <> 0 THEN RAISE EXCEPTION 'paper profile accounting failed: %',profile; END IF;
  UPDATE public.profiles SET show_profit=false,show_volume=false,show_roi=false WHERE id=u;
  profile := public.get_paper_profile(u);
  IF profile->>'total_profit' IS NOT NULL OR profile->>'winning_sales' IS NOT NULL OR profile->>'roi_percent' IS NOT NULL
    OR profile->'history'->0->>'notional_usd' IS NOT NULL THEN RAISE EXCEPTION 'private fields leaked'; END IF;
  UPDATE public.profiles SET show_trades=false WHERE id=u;
  profile := public.get_paper_profile(u);
  IF profile->>'total_trades' IS NOT NULL OR profile->'history' <> 'null'::jsonb THEN RAISE EXCEPTION 'trade privacy failed'; END IF;
  UPDATE public.profiles SET is_public=false WHERE id=u;
  IF public.get_paper_profile(u) IS NOT NULL THEN RAISE EXCEPTION 'private profile leaked'; END IF;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  profile := public.get_paper_profile(u);
  IF (profile->>'winning_sales')::integer <> 1 THEN RAISE EXCEPTION 'owner cannot see private data'; END IF;
  PERFORM public.reset_polymarket_paper_wallet();
  profile := public.get_paper_profile(u);
  IF (profile->>'sales_count')::integer <> 0 OR (profile->>'best_streak')::integer <> 0
    OR jsonb_array_length(profile->'history') <> 0 THEN RAISE EXCEPTION 'reset retained previous round'; END IF;
END $$;
ROLLBACK;
