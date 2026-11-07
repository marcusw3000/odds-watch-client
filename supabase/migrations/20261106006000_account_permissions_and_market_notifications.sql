-- User-facing grants complement existing RLS policies. Sensitive profile statistics
-- and notification content cannot be modified by ordinary clients.
GRANT SELECT ON public.profiles_public TO authenticated;
REVOKE UPDATE ON public.profiles, public.notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, bio, avatar_url, is_public, show_profit, show_roi, show_volume, show_trades) ON public.profiles TO authenticated;
GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.notifications, public.notification_preferences TO service_role;
GRANT INSERT ON public.audit_logs TO service_role;

-- Only the scheduled server function can record confirmed market closures.
CREATE TABLE public.polymarket_closure_checks (
  market_id text PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.polymarket_closure_notified (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, market_id)
);
ALTER TABLE public.polymarket_closure_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polymarket_closure_notified ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.polymarket_closure_checks, public.polymarket_closure_notified FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.polymarket_closure_candidates(p_limit integer DEFAULT 100)
RETURNS TABLE(market_id text) LANGUAGE sql SECURITY DEFINER SET search_path=public, pg_temp AS $$
  SELECT interests.market_id FROM (
    SELECT market_id FROM public.polymarket_favorites WHERE source='polymarket'
    UNION SELECT market_id FROM public.polymarket_paper_positions WHERE shares > 0
  ) interests
  LEFT JOIN public.polymarket_closure_checks c ON c.market_id=interests.market_id
  WHERE interests.market_id ~ '^[0-9]{1,20}$'
  ORDER BY c.checked_at ASC NULLS FIRST, interests.market_id
  LIMIT least(greatest(coalesce(p_limit,100),1),100);
$$;

CREATE FUNCTION public.polymarket_record_closure_checks(p_attempted text[], p_closed text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE inserted_count integer;
BEGIN
  IF cardinality(p_attempted) > 100 OR EXISTS (SELECT 1 FROM unnest(p_attempted) id WHERE id !~ '^[0-9]{1,20}$')
    OR EXISTS (SELECT 1 FROM unnest(p_closed) id WHERE NOT (id = ANY(p_attempted))) THEN
    RAISE EXCEPTION 'Invalid market identifiers';
  END IF;
  INSERT INTO public.polymarket_closure_checks(market_id,checked_at)
    SELECT DISTINCT id,now() FROM unnest(p_attempted) id
    ON CONFLICT (market_id) DO UPDATE SET checked_at=excluded.checked_at;
  WITH interests AS (
    SELECT f.user_id,f.market_id FROM public.polymarket_favorites f WHERE f.source='polymarket' AND f.market_id=ANY(p_closed)
    UNION SELECT p.user_id,p.market_id FROM public.polymarket_paper_positions p WHERE p.shares>0 AND p.market_id=ANY(p_closed)
  ), eligible AS (
    SELECT i.user_id,i.market_id FROM interests i
    LEFT JOIN public.notification_preferences p ON p.user_id=i.user_id
    WHERE coalesce(p.in_app_market_updates,true)
  ), marked AS (
    INSERT INTO public.polymarket_closure_notified(user_id,market_id)
      SELECT user_id,market_id FROM eligible ON CONFLICT DO NOTHING RETURNING user_id,market_id
  )
  INSERT INTO public.notifications(user_id,type,title,message,data)
    SELECT m.user_id,'MARKET_HALTED','Mercado Polymarket encerrado',
      coalesce(c.question, (SELECT p.market_question FROM public.polymarket_paper_positions p WHERE p.market_id=m.market_id LIMIT 1), 'Mercado #' || m.market_id) || ' foi encerrado.',
      jsonb_build_object('source','polymarket','market_id',m.market_id,'event','closed')
    FROM marked m LEFT JOIN public.polymarket_market_cache c ON c.market_id=m.market_id;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $$;
REVOKE ALL ON FUNCTION public.polymarket_closure_candidates(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.polymarket_record_closure_checks(text[],text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.polymarket_closure_candidates(integer), public.polymarket_record_closure_checks(text[],text[]) TO service_role;
NOTIFY pgrst, 'reload schema';
