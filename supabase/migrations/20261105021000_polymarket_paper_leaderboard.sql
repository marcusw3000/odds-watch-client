-- Ranking data and prices are separate from the legacy BRL leaderboard and real trading.
ALTER TABLE public.polymarket_paper_wallets ADD COLUMN round_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.polymarket_paper_positions
  ADD COLUMN legacy_shares numeric(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN legacy_cost numeric(24,12) NOT NULL DEFAULT 0,
  ADD COLUMN verified_cost numeric(24,12) NOT NULL DEFAULT 0;
UPDATE public.polymarket_paper_positions SET legacy_shares = shares, legacy_cost = shares * average_price;
ALTER TABLE public.polymarket_paper_positions ADD CONSTRAINT paper_position_costs_valid
  CHECK (legacy_shares >= 0 AND legacy_shares <= shares AND legacy_cost >= 0 AND verified_cost >= 0);

CREATE TABLE public.polymarket_paper_ranking_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  realized_profit numeric(24,12) NOT NULL DEFAULT 0,
  realized_cost numeric(24,12) NOT NULL DEFAULT 0 CHECK (realized_cost >= 0),
  volume_usd numeric(24,12) NOT NULL DEFAULT 0 CHECK (volume_usd >= 0),
  trade_count integer NOT NULL DEFAULT 0 CHECK (trade_count >= 0),
  winning_trades integer NOT NULL DEFAULT 0 CHECK (winning_trades >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.polymarket_paper_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  round_id uuid NOT NULL,
  market_id text NOT NULL,
  outcome_label text NOT NULL,
  side text NOT NULL,
  shares numeric(18,6) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE public.polymarket_paper_ranking_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polymarket_paper_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.polymarket_paper_wallets, public.polymarket_paper_positions, public.polymarket_paper_trades, public.polymarket_paper_ranking_stats, public.polymarket_paper_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.polymarket_paper_wallets, public.polymarket_paper_positions, public.polymarket_paper_trades TO authenticated;
DROP POLICY IF EXISTS "Users manage own paper wallet" ON public.polymarket_paper_wallets;
CREATE POLICY "Users read own paper wallet" ON public.polymarket_paper_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON FUNCTION public.execute_polymarket_paper_trade(text,text,text,text,text,numeric,numeric) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_verified_paper_request(p_user uuid, p_request uuid, p_round uuid, p_market text, p_outcome text, p_side text, p_shares numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.polymarket_paper_requests;
BEGIN
  SELECT * INTO r FROM public.polymarket_paper_requests WHERE user_id = p_user AND request_id = p_request;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.polymarket_paper_wallets WHERE user_id=p_user AND round_id=p_round) THEN RAISE EXCEPTION 'Carteira reiniciada; atualize a página'; END IF;
  IF r.round_id <> p_round OR r.market_id <> p_market OR r.outcome_label <> p_outcome OR r.side <> p_side OR r.shares <> p_shares THEN
    RAISE EXCEPTION 'Chave de operação já usada com outros dados';
  END IF;
  RETURN r.result;
END;
$$;

CREATE FUNCTION public.execute_verified_paper_trade(p_user uuid, p_request uuid, p_round uuid, p_market text, p_question text, p_outcome text, p_token text, p_side text, p_shares numeric, p_price numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE w public.polymarket_paper_wallets; pos public.polymarket_paper_positions; prior jsonb;
  total numeric; old_legacy numeric; old_verified numeric; sold_legacy numeric; sold_verified numeric;
  removed_legacy_cost numeric; removed_verified_cost numeric; remaining_shares numeric; eligible_volume numeric;
  eligible_profit numeric; result jsonb;
BEGIN
  IF p_user IS NULL OR p_request IS NULL OR p_round IS NULL OR p_market !~ '^[0-9]{1,20}$' OR p_token !~ '^[0-9]{1,100}$'
    OR p_outcome IS NULL OR length(p_outcome) NOT BETWEEN 1 AND 160 OR p_question IS NULL OR length(p_question) NOT BETWEEN 1 AND 1000
    OR p_side NOT IN ('BUY','SELL') OR p_shares IS NULL OR p_shares <= 0 OR p_shares > 1000000 OR p_shares <> round(p_shares, 6)
    OR p_price IS NULL OR p_price <= 0 OR p_price > 1 OR p_price <> round(p_price, 6) THEN RAISE EXCEPTION 'Operação simulada inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 190711));
  prior := public.get_verified_paper_request(p_user,p_request,p_round,p_market,p_outcome,p_side,p_shares);
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  INSERT INTO public.polymarket_paper_wallets(user_id) VALUES (p_user) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.polymarket_paper_wallets WHERE user_id = p_user FOR UPDATE;
  IF w.round_id <> p_round THEN RAISE EXCEPTION 'Carteira reiniciada; atualize a página'; END IF;
  total := round(p_price * p_shares, 6);
  IF total <= 0 THEN RAISE EXCEPTION 'Valor da operação é muito pequeno'; END IF;
  SELECT * INTO pos FROM public.polymarket_paper_positions WHERE user_id=p_user AND market_id=p_market AND outcome_label=p_outcome FOR UPDATE;
  IF p_side = 'BUY' THEN
    IF w.balance_usd < total THEN RAISE EXCEPTION 'Saldo virtual insuficiente'; END IF;
    UPDATE public.polymarket_paper_wallets SET balance_usd=balance_usd-total, updated_at=now() WHERE user_id=p_user;
    IF pos.id IS NULL THEN
      INSERT INTO public.polymarket_paper_positions(user_id,market_id,market_question,outcome_label,outcome_token_id,shares,average_price,legacy_shares,legacy_cost,verified_cost)
        VALUES(p_user,p_market,p_question,p_outcome,p_token,p_shares,p_price,0,0,total);
    ELSE
      IF pos.shares > pos.legacy_shares AND pos.outcome_token_id IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Resultado do mercado inconsistente'; END IF;
      UPDATE public.polymarket_paper_positions SET shares=pos.shares+p_shares, verified_cost=pos.verified_cost+total,
        average_price=round((pos.legacy_cost+pos.verified_cost+total)/(pos.shares+p_shares),6), outcome_token_id=p_token, updated_at=now() WHERE id=pos.id;
    END IF;
    eligible_volume := total; eligible_profit := 0; removed_verified_cost := 0;
  ELSE
    IF pos.id IS NULL OR pos.shares < p_shares THEN RAISE EXCEPTION 'Shares simuladas insuficientes'; END IF;
    IF pos.shares > pos.legacy_shares AND pos.outcome_token_id IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'Resultado do mercado inconsistente'; END IF;
    old_legacy := pos.legacy_shares; old_verified := pos.shares-old_legacy;
    sold_legacy := least(old_legacy,p_shares); sold_verified := p_shares-sold_legacy;
    removed_legacy_cost := CASE WHEN old_legacy > 0 THEN pos.legacy_cost*sold_legacy/old_legacy ELSE 0 END;
    removed_verified_cost := CASE WHEN old_verified > 0 THEN pos.verified_cost*sold_verified/old_verified ELSE 0 END;
    eligible_volume := round(total*sold_verified/p_shares,6);
    eligible_profit := eligible_volume-removed_verified_cost;
    remaining_shares := pos.shares-p_shares;
    UPDATE public.polymarket_paper_wallets SET balance_usd=balance_usd+total, updated_at=now() WHERE user_id=p_user;
    IF remaining_shares=0 THEN DELETE FROM public.polymarket_paper_positions WHERE id=pos.id;
    ELSE UPDATE public.polymarket_paper_positions SET shares=remaining_shares, legacy_shares=old_legacy-sold_legacy,
      legacy_cost=greatest(0,pos.legacy_cost-removed_legacy_cost), verified_cost=greatest(0,pos.verified_cost-removed_verified_cost),
      average_price=round((greatest(0,pos.legacy_cost-removed_legacy_cost)+greatest(0,pos.verified_cost-removed_verified_cost))/remaining_shares,6), outcome_token_id=p_token, updated_at=now() WHERE id=pos.id;
    END IF;
  END IF;
  INSERT INTO public.polymarket_paper_trades(user_id,market_id,outcome_label,side,price,shares,notional_usd)
    VALUES(p_user,p_market,p_outcome,p_side,p_price,p_shares,total);
  IF p_side='BUY' OR eligible_volume > 0 THEN
    INSERT INTO public.polymarket_paper_ranking_stats(user_id,realized_profit,realized_cost,volume_usd,trade_count,winning_trades)
    VALUES(p_user,eligible_profit,removed_verified_cost,eligible_volume,1,CASE WHEN p_side='SELL' AND eligible_profit>0 THEN 1 ELSE 0 END)
    ON CONFLICT(user_id) DO UPDATE SET realized_profit=polymarket_paper_ranking_stats.realized_profit+EXCLUDED.realized_profit,
      realized_cost=polymarket_paper_ranking_stats.realized_cost+EXCLUDED.realized_cost, volume_usd=polymarket_paper_ranking_stats.volume_usd+EXCLUDED.volume_usd,
      trade_count=polymarket_paper_ranking_stats.trade_count+1, winning_trades=polymarket_paper_ranking_stats.winning_trades+EXCLUDED.winning_trades, updated_at=now();
  END IF;
  result := jsonb_build_object('success',true,'price',p_price,'notional_usd',total,'ranked_notional_usd',eligible_volume,'realized_profit',eligible_profit);
  INSERT INTO public.polymarket_paper_requests(user_id,request_id,round_id,market_id,outcome_label,side,shares,result)
    VALUES(p_user,p_request,p_round,p_market,p_outcome,p_side,p_shares,result);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_verified_paper_request(uuid,uuid,uuid,text,text,text,numeric), public.execute_verified_paper_trade(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_verified_paper_request(uuid,uuid,uuid,text,text,text,numeric), public.execute_verified_paper_trade(uuid,uuid,uuid,text,text,text,text,text,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_polymarket_paper_wallet() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 190711));
  DELETE FROM public.polymarket_paper_positions WHERE user_id=uid;
  DELETE FROM public.polymarket_paper_trades WHERE user_id=uid;
  DELETE FROM public.polymarket_paper_ranking_stats WHERE user_id=uid;
  INSERT INTO public.polymarket_paper_wallets(user_id,balance_usd,round_id) VALUES(uid,10000,gen_random_uuid())
    ON CONFLICT(user_id) DO UPDATE SET balance_usd=10000,round_id=gen_random_uuid(),updated_at=now();
END;
$$;
REVOKE ALL ON FUNCTION public.reset_polymarket_paper_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_polymarket_paper_wallet() TO authenticated;

CREATE FUNCTION public.get_paper_leaderboard(p_sort text DEFAULT 'profit', p_limit integer DEFAULT 50)
RETURNS TABLE(rank bigint,user_id uuid,display_name text,avatar_url text,total_profit numeric,roi_percent numeric,total_volume numeric,total_trades integer,winning_trades integer,show_profit boolean,show_roi boolean,show_volume boolean,show_trades boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$
  WITH eligible AS (
    SELECT p.id, p.display_name, p.avatar_url, p.show_profit, p.show_roi, p.show_volume, p.show_trades,
      s.realized_profit, CASE WHEN s.realized_cost>0 THEN 100*s.realized_profit/s.realized_cost ELSE 0 END AS roi,
      s.volume_usd, s.trade_count, s.winning_trades
    FROM public.polymarket_paper_ranking_stats s JOIN public.profiles p ON p.id=s.user_id
    WHERE p.is_public IS TRUE AND nullif(btrim(p.display_name),'') IS NOT NULL AND s.trade_count>0
      AND CASE p_sort WHEN 'roi' THEN p.show_roi WHEN 'volume' THEN p.show_volume WHEN 'trades' THEN p.show_trades ELSE p.show_profit END IS TRUE
  ), ranked AS (
    SELECT *, row_number() OVER (ORDER BY CASE p_sort WHEN 'roi' THEN roi WHEN 'volume' THEN volume_usd WHEN 'trades' THEN trade_count ELSE realized_profit END DESC, id ASC) AS rn FROM eligible
  )
  SELECT rn,id,ranked.display_name,ranked.avatar_url,
    CASE WHEN ranked.show_profit THEN realized_profit END, CASE WHEN ranked.show_roi THEN roi END,
    CASE WHEN ranked.show_volume THEN volume_usd END, CASE WHEN ranked.show_trades THEN trade_count END,
    CASE WHEN ranked.show_trades AND ranked.show_profit THEN ranked.winning_trades END,
    ranked.show_profit,ranked.show_roi,ranked.show_volume,ranked.show_trades
  FROM ranked ORDER BY rn LIMIT greatest(1,least(coalesce(p_limit,50),100));
$$;
CREATE FUNCTION public.get_my_paper_ranking_stats() RETURNS TABLE(total_profit numeric,roi_percent numeric,total_volume numeric,total_trades integer,winning_trades integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$
  SELECT coalesce(s.realized_profit,0), CASE WHEN coalesce(s.realized_cost,0)>0 THEN 100*s.realized_profit/s.realized_cost ELSE 0 END,
    coalesce(s.volume_usd,0),coalesce(s.trade_count,0),coalesce(s.winning_trades,0)
  FROM (SELECT auth.uid() AS uid) me LEFT JOIN public.polymarket_paper_ranking_stats s ON s.user_id=me.uid WHERE me.uid IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_paper_leaderboard(text,integer), public.get_my_paper_ranking_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paper_leaderboard(text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_paper_ranking_stats() TO authenticated;
NOTIFY pgrst, 'reload schema';
