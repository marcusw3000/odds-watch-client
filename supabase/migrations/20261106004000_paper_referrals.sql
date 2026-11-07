-- Recreational referrals only: no deposits, fees, commissions or financial credits.
CREATE TABLE public.paper_referral_codes (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-F0-9]{12}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.paper_referral_links (
  referred_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES public.paper_referral_codes(owner_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referred_id <> referrer_id)
);
CREATE INDEX paper_referral_links_referrer_idx ON public.paper_referral_links(referrer_id);
ALTER TABLE public.paper_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_referral_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paper_referral_codes, public.paper_referral_links FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_my_paper_referral_code() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE uid uuid := auth.uid(); existing text; candidate text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 51486));
  SELECT code INTO existing FROM public.paper_referral_codes WHERE owner_id=uid;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    BEGIN
      INSERT INTO public.paper_referral_codes(owner_id,code) VALUES(uid,candidate);
      RETURN candidate;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;
END $$;

CREATE FUNCTION public.apply_paper_referral(p_code text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE uid uuid := auth.uid(); referrer uuid; existing uuid; account_created timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 51487));
  SELECT referrer_id INTO existing FROM public.paper_referral_links WHERE referred_id=uid;
  IF existing IS NOT NULL THEN RETURN 'already_linked'; END IF;
  SELECT created_at INTO account_created FROM auth.users WHERE id=uid;
  -- This limits attribution to recent accounts that have never traded, including before a reset.
  IF account_created IS NULL OR account_created < now() - interval '7 days'
    OR EXISTS (SELECT 1 FROM public.polymarket_paper_requests WHERE user_id=uid)
    OR EXISTS (SELECT 1 FROM public.polymarket_paper_trades WHERE user_id=uid) THEN RETURN 'ineligible'; END IF;
  IF p_code IS NULL OR upper(btrim(p_code)) !~ '^[A-F0-9]{12}$' THEN RETURN 'invalid'; END IF;
  SELECT owner_id INTO referrer FROM public.paper_referral_codes WHERE code=upper(btrim(p_code));
  IF referrer IS NULL THEN RETURN 'invalid'; END IF;
  IF referrer=uid THEN RETURN 'own_code'; END IF;
  INSERT INTO public.paper_referral_links(referred_id,referrer_id) VALUES(uid,referrer);
  RETURN 'applied';
END $$;

CREATE FUNCTION public.get_my_paper_referral_stats()
RETURNS TABLE(total_referred bigint, active_referred bigint, verified_trades bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$
  SELECT count(*), count(*) FILTER (WHERE coalesce(s.trade_count,0)>0), coalesce(sum(s.trade_count),0)::bigint
  FROM public.paper_referral_links l LEFT JOIN public.polymarket_paper_ranking_stats s ON s.user_id=l.referred_id
  WHERE auth.uid() IS NOT NULL AND l.referrer_id=auth.uid();
$$;
CREATE FUNCTION public.get_paper_referral_admin_stats()
RETURNS TABLE(total_codes bigint,total_referred bigint,active_referred bigint,verified_trades bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT (SELECT count(*) FROM public.paper_referral_codes), count(*),
    count(*) FILTER (WHERE coalesce(s.trade_count,0)>0), coalesce(sum(s.trade_count),0)::bigint
    FROM public.paper_referral_links l LEFT JOIN public.polymarket_paper_ranking_stats s ON s.user_id=l.referred_id;
END $$;
REVOKE ALL ON FUNCTION public.get_my_paper_referral_code(), public.apply_paper_referral(text), public.get_my_paper_referral_stats(), public.get_paper_referral_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_paper_referral_code(), public.apply_paper_referral(text), public.get_my_paper_referral_stats(), public.get_paper_referral_admin_stats() TO authenticated;

-- Old BRL accounting routines trusted caller-provided amounts and are not used by the simulator.
REVOKE ALL ON FUNCTION public.activate_referral_on_deposit(uuid,numeric), public.process_referral_commission(uuid,numeric,numeric,uuid), public.get_active_referral_discount(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_referral_on_deposit(uuid,numeric), public.process_referral_commission(uuid,numeric,numeric,uuid), public.get_active_referral_discount(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
