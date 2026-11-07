-- Serialize attribution with verified paper operations and wallet reset.
CREATE OR REPLACE FUNCTION public.apply_paper_referral(p_code text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE uid uuid := auth.uid(); referrer uuid; existing uuid; account_created timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 190711));
  SELECT referrer_id INTO existing FROM public.paper_referral_links WHERE referred_id=uid;
  IF existing IS NOT NULL THEN RETURN 'already_linked'; END IF;
  SELECT created_at INTO account_created FROM auth.users WHERE id=uid;
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
-- Data export runs with service_role and restricts every read to the authenticated user.
-- Clients retain their existing row-level and column-level restrictions.
GRANT SELECT ON public.paper_referral_codes, public.paper_referral_links,
  public.profiles, public.wallets, public.polymarket_paper_wallets, public.polymarket_paper_positions,
  public.polymarket_paper_trades, public.payments, public.notifications,
  public.polymarket_event_comments, public.polymarket_favorites, public.audit_logs TO service_role;
GRANT INSERT ON public.audit_logs TO service_role;
NOTIFY pgrst, 'reload schema';
