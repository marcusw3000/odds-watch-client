-- Simulated commissions begin with sales processed after this migration.
CREATE TABLE public.paper_copy_referral_rounds (
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_id uuid NOT NULL,
  realized_usd numeric(24,6) NOT NULL DEFAULT 0,
  high_water_usd numeric(24,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (referred_id, round_id)
);

CREATE TABLE public.paper_copy_referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL UNIQUE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_id uuid NOT NULL,
  gross_sale_profit_usd numeric(24,6) NOT NULL,
  eligible_profit_usd numeric(24,6) NOT NULL CHECK (eligible_profit_usd > 0),
  commission_usd numeric(24,6) NOT NULL CHECK (commission_usd > 0),
  allocations jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referred_id <> referrer_id)
);
CREATE INDEX paper_copy_referral_commissions_referrer_idx ON public.paper_copy_referral_commissions(referrer_id,created_at DESC);
CREATE INDEX paper_copy_referral_commissions_referred_round_idx ON public.paper_copy_referral_commissions(referred_id,round_id);
ALTER TABLE public.paper_copy_referral_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_copy_referral_commissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paper_copy_referral_rounds, public.paper_copy_referral_commissions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.allocate_paper_copy_sale() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE remaining numeric; previous_total numeric; item record; qty numeric; removed_cost numeric; target uuid;
  sale_profit numeric := 0; allocation_profit numeric; allocations jsonb := '[]'::jsonb;
  referrer uuid; wallet_round uuid; prior record; new_total numeric; eligible numeric; commission numeric;
BEGIN
  IF NEW.side <> 'SELL' THEN RETURN NEW; END IF;
  target:=nullif(current_setting('app.paper_copy_sell_strategy',true),'')::uuid;
  SELECT shares INTO remaining FROM public.polymarket_paper_positions WHERE user_id=NEW.user_id AND market_id=NEW.market_id AND outcome_label=NEW.outcome_label;
  previous_total:=coalesce(remaining,0)+NEW.shares;
  FOR item IN SELECT cp.* FROM public.paper_copy_positions cp JOIN public.paper_copy_strategies s ON s.id=cp.strategy_id JOIN public.polymarket_paper_wallets w ON w.user_id=s.user_id AND w.round_id=cp.round_id WHERE s.user_id=NEW.user_id AND cp.market_id=NEW.market_id AND cp.outcome=NEW.outcome_label AND cp.shares>0 AND (target IS NULL OR cp.strategy_id=target) ORDER BY cp.strategy_id FOR UPDATE OF cp LOOP
    qty:=CASE WHEN target IS NOT NULL THEN NEW.shares WHEN NEW.shares=previous_total THEN item.shares ELSE trunc(item.shares*NEW.shares/previous_total,6) END;
    IF qty>item.shares THEN RAISE EXCEPTION 'Shares copiadas insuficientes'; END IF;
    IF qty>0 THEN
      removed_cost:=CASE WHEN qty=item.shares THEN item.cost_usd ELSE round(item.cost_usd*qty/item.shares,6) END;
      allocation_profit:=round(qty*NEW.price,6)-removed_cost;
      sale_profit:=sale_profit+allocation_profit;
      allocations:=allocations || jsonb_build_array(jsonb_build_object('strategy_id',item.strategy_id,'shares',qty,'cost_usd',removed_cost,'profit_usd',allocation_profit));
      UPDATE public.paper_copy_positions SET shares=shares-qty,cost_usd=greatest(0,cost_usd-removed_cost),realized_usd=realized_usd+allocation_profit WHERE strategy_id=item.strategy_id AND round_id=item.round_id AND market_id=item.market_id AND outcome=item.outcome;
    END IF;
  END LOOP;
  IF jsonb_array_length(allocations)=0 THEN RETURN NEW; END IF;
  SELECT referrer_id INTO referrer FROM public.paper_referral_links WHERE referred_id=NEW.user_id;
  IF referrer IS NULL OR referrer=NEW.user_id THEN RETURN NEW; END IF;
  SELECT round_id INTO wallet_round FROM public.polymarket_paper_wallets WHERE user_id=NEW.user_id;
  INSERT INTO public.paper_copy_referral_rounds(referred_id,round_id) VALUES(NEW.user_id,wallet_round) ON CONFLICT DO NOTHING;
  SELECT * INTO prior FROM public.paper_copy_referral_rounds WHERE referred_id=NEW.user_id AND round_id=wallet_round FOR UPDATE;
  new_total:=prior.realized_usd+sale_profit;
  eligible:=greatest(0,new_total-prior.high_water_usd);
  commission:=round(eligible*0.10,6);
  UPDATE public.paper_copy_referral_rounds SET realized_usd=new_total, high_water_usd=greatest(prior.high_water_usd,new_total) WHERE referred_id=NEW.user_id AND round_id=wallet_round;
  IF commission > 0 THEN
    INSERT INTO public.paper_copy_referral_commissions(trade_id,referred_id,referrer_id,round_id,gross_sale_profit_usd,eligible_profit_usd,commission_usd,allocations)
      VALUES(NEW.id,NEW.user_id,referrer,wallet_round,sale_profit,eligible,commission,allocations);
    UPDATE public.polymarket_paper_wallets SET balance_usd=balance_usd-commission,updated_at=now() WHERE user_id=NEW.user_id AND balance_usd>=commission;
    IF NOT FOUND THEN RAISE EXCEPTION 'Saldo virtual insuficiente para o repasse'; END IF;
    INSERT INTO public.polymarket_paper_wallets(user_id,balance_usd) VALUES(referrer,10000+commission)
      ON CONFLICT(user_id) DO UPDATE SET balance_usd=polymarket_paper_wallets.balance_usd+commission,updated_at=now();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.allocate_paper_copy_sale() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.get_my_paper_copy_referral_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid(); result jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT jsonb_build_object(
    'rate',0.10,
    'received_usd',coalesce((SELECT sum(commission_usd) FROM public.paper_copy_referral_commissions WHERE referrer_id=uid),0),
    'paid_current_round_usd',coalesce((SELECT sum(c.commission_usd) FROM public.paper_copy_referral_commissions c JOIN public.polymarket_paper_wallets w ON w.user_id=c.referred_id AND w.round_id=c.round_id WHERE c.referred_id=uid),0),
    'history',coalesce((SELECT jsonb_agg(jsonb_build_object('created_at',h.created_at,'commission_usd',h.commission_usd) ORDER BY h.created_at DESC) FROM (SELECT created_at,commission_usd FROM public.paper_copy_referral_commissions WHERE referrer_id=uid ORDER BY created_at DESC,id DESC LIMIT 50) h),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_my_paper_copy_referral_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_paper_copy_referral_summary() TO authenticated;
NOTIFY pgrst,'reload schema';
