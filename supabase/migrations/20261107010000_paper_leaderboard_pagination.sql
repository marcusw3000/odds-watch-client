CREATE FUNCTION public.get_paper_leaderboard_page(p_sort text DEFAULT 'profit', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
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
  FROM ranked ORDER BY rn OFFSET greatest(0,coalesce(p_offset,0)) LIMIT greatest(1,least(coalesce(p_limit,50),100));
$$;
REVOKE ALL ON FUNCTION public.get_paper_leaderboard_page(text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paper_leaderboard_page(text,integer,integer) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
