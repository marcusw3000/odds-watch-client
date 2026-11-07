-- Paper profile data is independent of the legacy BRL profile statistics.
CREATE OR REPLACE FUNCTION public.get_paper_profile(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.profiles; s public.polymarket_paper_ranking_stats; own_profile boolean;
  profit_visible boolean; trades_visible boolean; volume_visible boolean; roi_visible boolean;
  sales_count integer; wins integer; best_profit numeric; current_streak integer; best_streak integer;
  history jsonb;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_user;
  IF NOT FOUND THEN RETURN NULL; END IF;
  own_profile := auth.uid() IS NOT NULL AND auth.uid() = p_user;
  IF NOT own_profile AND p.is_public IS DISTINCT FROM true THEN RETURN NULL; END IF;
  profit_visible := own_profile OR p.show_profit IS TRUE;
  trades_visible := own_profile OR p.show_trades IS TRUE;
  volume_visible := own_profile OR p.show_volume IS TRUE;
  roi_visible := own_profile OR p.show_roi IS TRUE;
  SELECT * INTO s FROM public.polymarket_paper_ranking_stats WHERE user_id=p_user;

  -- Requests are retained for idempotency after reset. Only the current round counts.
  WITH sales AS (
    SELECT r.created_at, r.request_id, (r.result->>'realized_profit')::numeric AS profit
    FROM public.polymarket_paper_requests r
    JOIN public.polymarket_paper_wallets w ON w.user_id=r.user_id AND w.round_id=r.round_id
    WHERE r.user_id=p_user AND r.side='SELL' AND (r.result->>'ranked_notional_usd')::numeric > 0
  ), runs AS (
    SELECT *, sum(CASE WHEN profit <= 0 THEN 1 ELSE 0 END) OVER (ORDER BY created_at, request_id) AS grp
    FROM sales
  ), streaks AS (
    SELECT grp, count(*)::integer AS length FROM runs WHERE profit > 0 GROUP BY grp
  )
  SELECT count(*)::integer, count(*) FILTER (WHERE profit > 0)::integer, greatest(coalesce(max(profit),0),0),
    coalesce((SELECT length FROM streaks WHERE grp=(SELECT grp FROM runs ORDER BY created_at DESC, request_id DESC LIMIT 1)),0),
    coalesce((SELECT max(length) FROM streaks),0)
  INTO sales_count, wins, best_profit, current_streak, best_streak FROM sales;

  IF trades_visible THEN
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC, t.id DESC),'[]'::jsonb) INTO history FROM (
      SELECT t.id,t.market_id,coalesce(c.question, 'Mercado ' || t.market_id) AS question,t.outcome_label,t.side,t.created_at,
        CASE WHEN profit_visible AND volume_visible THEN t.shares END AS shares,
        CASE WHEN profit_visible AND volume_visible THEN t.price END AS price,
        CASE WHEN profit_visible AND volume_visible THEN t.notional_usd END AS notional_usd
      FROM public.polymarket_paper_trades t LEFT JOIN public.polymarket_market_cache c
        ON c.source='polymarket' AND c.market_id=t.market_id
      WHERE t.user_id=p_user ORDER BY t.created_at DESC, t.id DESC LIMIT 100
    ) t;
  END IF;
  RETURN jsonb_build_object(
    'total_profit', CASE WHEN profit_visible THEN coalesce(s.realized_profit,0) END,
    'roi_percent', CASE WHEN roi_visible THEN CASE WHEN coalesce(s.realized_cost,0)>0 THEN 100*s.realized_profit/s.realized_cost ELSE 0 END END,
    'total_volume', CASE WHEN volume_visible THEN coalesce(s.volume_usd,0) END,
    'total_trades', CASE WHEN trades_visible THEN coalesce(s.trade_count,0) END,
    'sales_count', CASE WHEN trades_visible AND profit_visible THEN sales_count END,
    'winning_sales', CASE WHEN trades_visible AND profit_visible THEN wins END,
    'best_trade_profit', CASE WHEN trades_visible AND profit_visible THEN best_profit END,
    'current_streak', CASE WHEN trades_visible AND profit_visible THEN current_streak END,
    'best_streak', CASE WHEN trades_visible AND profit_visible THEN best_streak END,
    'history', history
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_paper_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_paper_profile(uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
