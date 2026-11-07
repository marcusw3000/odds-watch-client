CREATE TABLE public.paper_portfolio_snapshots (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_id uuid NOT NULL,
  observed_hour timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  positions_value numeric(24,6) NOT NULL CHECK (positions_value >= 0),
  open_pnl numeric(24,6) NOT NULL,
  realized_pnl numeric(24,6) NOT NULL,
  PRIMARY KEY(user_id,round_id,observed_hour)
);
CREATE TABLE public.paper_portfolio_snapshot_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_at timestamptz,
  last_success_at timestamptz,
  round_id uuid
);
ALTER TABLE public.paper_portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_portfolio_snapshot_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paper_portfolio_snapshots,public.paper_portfolio_snapshot_state FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.paper_portfolio_snapshots TO authenticated;
GRANT ALL ON public.paper_portfolio_snapshots,public.paper_portfolio_snapshot_state TO service_role;
CREATE POLICY own_paper_snapshots ON public.paper_portfolio_snapshots FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE FUNCTION public.paper_snapshot_candidates() RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT w.user_id FROM public.polymarket_paper_wallets w LEFT JOIN public.paper_portfolio_snapshot_state st ON st.user_id=w.user_id
  WHERE (st.checked_at IS NULL OR st.checked_at < now()-interval '5 minutes')
    AND (st.last_success_at IS NULL OR st.last_success_at < now()-interval '1 hour' OR st.round_id IS DISTINCT FROM w.round_id)
    AND (EXISTS(SELECT 1 FROM public.polymarket_paper_positions p WHERE p.user_id=w.user_id)
      OR EXISTS(SELECT 1 FROM public.polymarket_paper_trades t WHERE t.user_id=w.user_id AND t.created_at>coalesce(st.last_success_at,'epoch'::timestamptz)))
  ORDER BY st.checked_at ASC NULLS FIRST,w.user_id LIMIT 5;
$$;
CREATE FUNCTION public.save_paper_portfolio_snapshot(p_user uuid,p_round uuid,p_wallet_updated timestamptz,p_positions_value numeric,p_open_pnl numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w public.polymarket_paper_wallets; realized numeric;
BEGIN
  IF p_user IS NULL OR p_round IS NULL OR p_wallet_updated IS NULL OR p_positions_value IS NULL OR p_open_pnl IS NULL OR p_positions_value::text IN ('NaN','Infinity','-Infinity') OR p_open_pnl::text IN ('NaN','Infinity','-Infinity') OR p_positions_value<0 THEN RAISE EXCEPTION 'Amostra inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,190711));
  SELECT * INTO w FROM public.polymarket_paper_wallets WHERE user_id=p_user FOR UPDATE;
  IF NOT FOUND OR w.round_id<>p_round OR w.updated_at<>p_wallet_updated THEN RAISE EXCEPTION 'Carteira alterada durante a cotação'; END IF;
  SELECT coalesce(realized_profit,0) INTO realized FROM public.polymarket_paper_ranking_stats WHERE user_id=p_user;
  INSERT INTO public.paper_portfolio_snapshots(user_id,round_id,observed_hour,positions_value,open_pnl,realized_pnl)
    VALUES(p_user,p_round,date_trunc('hour',now()),p_positions_value,p_open_pnl,coalesce(realized,0))
    ON CONFLICT(user_id,round_id,observed_hour) DO UPDATE SET observed_at=now(),positions_value=EXCLUDED.positions_value,open_pnl=EXCLUDED.open_pnl,realized_pnl=EXCLUDED.realized_pnl;
  INSERT INTO public.paper_portfolio_snapshot_state(user_id,checked_at,last_success_at,round_id) VALUES(p_user,now(),now(),p_round) ON CONFLICT(user_id) DO UPDATE SET checked_at=now(),last_success_at=now(),round_id=p_round;
END $$;
CREATE FUNCTION public.mark_paper_snapshot_attempt(p_user uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  INSERT INTO public.paper_portfolio_snapshot_state(user_id,checked_at) VALUES(p_user,now()) ON CONFLICT(user_id) DO UPDATE SET checked_at=now();
$$;
REVOKE ALL ON FUNCTION public.paper_snapshot_candidates(),public.save_paper_portfolio_snapshot(uuid,uuid,timestamptz,numeric,numeric),public.mark_paper_snapshot_attempt(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.paper_snapshot_candidates(),public.save_paper_portfolio_snapshot(uuid,uuid,timestamptz,numeric,numeric),public.mark_paper_snapshot_attempt(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
