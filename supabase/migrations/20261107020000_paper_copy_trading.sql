-- Copy strategies use only the simulated USD wallet. No CLOB orders are submitted.
CREATE TABLE public.paper_copy_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('polymarket','paper')),
  source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 80),
  source_name text NOT NULL CHECK (length(source_name) BETWEEN 1 AND 100),
  round_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('automatic','manual')),
  total_limit numeric(18,6) NOT NULL CHECK (total_limit > 0 AND total_limit <= 1000000),
  per_trade_limit numeric(18,6) NOT NULL CHECK (per_trade_limit > 0 AND per_trade_limit <= total_limit),
  spent_usd numeric(18,6) NOT NULL DEFAULT 0 CHECK (spent_usd >= 0),
  max_price_deviation numeric(8,6) NOT NULL DEFAULT 0.03 CHECK (max_price_deviation BETWEEN 0 AND 1),
  active boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  monitored_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,source_kind,source_id)
);
CREATE TABLE public.paper_copy_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES public.paper_copy_strategies(id) ON DELETE CASCADE,
  source_key text NOT NULL CHECK (length(source_key) BETWEEN 1 AND 300),
  market_id text NOT NULL CHECK (market_id ~ '^\d{1,20}$'),
  question text NOT NULL CHECK (length(question) BETWEEN 1 AND 1000),
  outcome text NOT NULL CHECK (length(outcome) BETWEEN 1 AND 160),
  source_price numeric(18,6) NOT NULL CHECK (source_price > 0 AND source_price <= 1),
  source_notional numeric(18,6) NOT NULL CHECK (source_notional > 0),
  source_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','executed','rejected','skipped')),
  result jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(strategy_id,source_key)
);
CREATE TABLE public.paper_copy_positions (
  strategy_id uuid NOT NULL REFERENCES public.paper_copy_strategies(id) ON DELETE CASCADE,
  round_id uuid NOT NULL,
  market_id text NOT NULL,
  outcome text NOT NULL,
  shares numeric(18,6) NOT NULL DEFAULT 0 CHECK (shares >= 0),
  cost_usd numeric(18,6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  realized_usd numeric(18,6) NOT NULL DEFAULT 0,
  PRIMARY KEY(strategy_id,round_id,market_id,outcome)
);
ALTER TABLE public.polymarket_paper_trades ADD COLUMN copy_signal_id uuid REFERENCES public.paper_copy_signals(id) ON DELETE SET NULL;
CREATE INDEX paper_copy_strategy_active_idx ON public.paper_copy_strategies(source_kind,source_id) WHERE active;
CREATE INDEX paper_copy_signal_strategy_idx ON public.paper_copy_signals(strategy_id,created_at DESC);
ALTER TABLE public.paper_copy_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_copy_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_copy_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paper_copy_strategies, public.paper_copy_signals, public.paper_copy_positions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.paper_copy_strategies, public.paper_copy_signals, public.paper_copy_positions TO authenticated;
GRANT ALL ON public.paper_copy_strategies, public.paper_copy_signals, public.paper_copy_positions TO service_role;
CREATE POLICY paper_copy_own_strategies ON public.paper_copy_strategies FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY paper_copy_own_signals ON public.paper_copy_signals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.paper_copy_strategies s WHERE s.id=strategy_id AND s.user_id=auth.uid()));
CREATE POLICY paper_copy_own_positions ON public.paper_copy_positions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.paper_copy_strategies s WHERE s.id=strategy_id AND s.user_id=auth.uid()));

CREATE FUNCTION public.save_paper_copy_strategy(p_kind text,p_source text,p_name text,p_mode text,p_total numeric,p_per_trade numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid := auth.uid(); result_id uuid; source_uuid uuid; wallet_round uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF p_kind IS NULL OR p_source IS NULL OR p_mode IS NULL OR p_kind NOT IN ('paper','polymarket') OR p_mode NOT IN ('automatic','manual') OR p_total IS NULL OR p_per_trade IS NULL OR p_total::text IN ('NaN','Infinity','-Infinity') OR p_per_trade::text IN ('NaN','Infinity','-Infinity') OR p_total <= 0 OR p_total > 1000000 OR p_per_trade <= 0 OR p_per_trade > p_total OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Parâmetros inválidos'; END IF;
  IF p_kind='polymarket' THEN
    IF p_source !~* '^0x[0-9a-f]{40}$' THEN RAISE EXCEPTION 'Carteira inválida'; END IF;
    p_source := lower(p_source);
  ELSE
    BEGIN source_uuid := p_source::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Trader inválido'; END;
    IF source_uuid=uid OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=source_uuid AND is_public AND show_trades) THEN RAISE EXCEPTION 'Trader indisponível para cópia'; END IF;
    p_source := source_uuid::text;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 190711));
  IF (SELECT count(*) FROM public.paper_copy_strategies WHERE user_id=uid AND active AND NOT (source_kind=p_kind AND source_id=p_source)) >= 10 THEN RAISE EXCEPTION 'Limite de estratégias ativas atingido'; END IF;
  INSERT INTO public.polymarket_paper_wallets(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  SELECT round_id INTO wallet_round FROM public.polymarket_paper_wallets WHERE user_id=uid FOR UPDATE;
  INSERT INTO public.paper_copy_strategies(user_id,source_kind,source_id,source_name,round_id,mode,total_limit,per_trade_limit)
  VALUES(uid,p_kind,p_source,btrim(p_name),wallet_round,p_mode,p_total,p_per_trade)
  ON CONFLICT(user_id,source_kind,source_id) DO UPDATE SET source_name=EXCLUDED.source_name,mode=EXCLUDED.mode,total_limit=EXCLUDED.total_limit,per_trade_limit=EXCLUDED.per_trade_limit,active=true,spent_usd=CASE WHEN paper_copy_strategies.round_id <> EXCLUDED.round_id THEN 0 ELSE paper_copy_strategies.spent_usd END,started_at=CASE WHEN NOT paper_copy_strategies.active OR paper_copy_strategies.round_id <> EXCLUDED.round_id OR paper_copy_strategies.mode <> EXCLUDED.mode THEN now() ELSE paper_copy_strategies.started_at END,monitored_at=CASE WHEN NOT paper_copy_strategies.active OR paper_copy_strategies.round_id <> EXCLUDED.round_id OR paper_copy_strategies.mode <> EXCLUDED.mode THEN now() ELSE paper_copy_strategies.monitored_at END,round_id=EXCLUDED.round_id,updated_at=now()
  RETURNING id INTO result_id;
  RETURN result_id;
END $$;
CREATE FUNCTION public.set_paper_copy_active(p_strategy uuid,p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid := auth.uid(); s public.paper_copy_strategies;
BEGIN
  IF uid IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 190711));
  SELECT * INTO s FROM public.paper_copy_strategies WHERE id=p_strategy AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estratégia não encontrada'; END IF;
  IF p_active AND NOT s.active AND (SELECT count(*) FROM public.paper_copy_strategies WHERE user_id=uid AND active) >= 10 THEN RAISE EXCEPTION 'Limite de estratégias ativas atingido'; END IF;
  IF p_active AND s.source_kind='paper' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id::text=s.source_id AND is_public AND show_trades) THEN RAISE EXCEPTION 'Trader indisponível para cópia'; END IF;
  UPDATE public.paper_copy_strategies SET active=p_active,started_at=CASE WHEN p_active AND NOT active THEN now() ELSE started_at END,monitored_at=CASE WHEN p_active AND NOT active THEN now() ELSE monitored_at END,checked_at=now(),updated_at=now() WHERE id=p_strategy AND user_id=uid AND (NOT p_active OR round_id=(SELECT round_id FROM public.polymarket_paper_wallets WHERE user_id=uid));
  IF NOT FOUND THEN RAISE EXCEPTION 'Estratégia não encontrada'; END IF;
END $$;
CREATE FUNCTION public.create_paper_copy_signal(p_strategy uuid,p_key text,p_market text,p_question text,p_outcome text,p_price numeric,p_notional numeric,p_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.paper_copy_strategies; signal_id uuid; next_status text;
BEGIN
  SELECT * INTO s FROM public.paper_copy_strategies WHERE id=p_strategy FOR UPDATE;
  IF NOT FOUND OR NOT s.active OR p_at < s.started_at OR p_at > now()+interval '1 minute' THEN RETURN NULL; END IF;
  IF s.source_kind='paper' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id::text=s.source_id AND is_public AND show_trades) THEN RETURN NULL; END IF;
  next_status := CASE WHEN p_at < now()-interval '15 minutes' THEN 'skipped' WHEN s.mode='automatic' THEN 'approved' ELSE 'pending' END;
  INSERT INTO public.paper_copy_signals(strategy_id,source_key,market_id,question,outcome,source_price,source_notional,source_at,status,reason)
    VALUES(s.id,p_key,p_market,p_question,p_outcome,p_price,p_notional,p_at,next_status,CASE WHEN next_status='skipped' THEN 'Sinal recebido com atraso superior a 15 minutos' END)
    ON CONFLICT(strategy_id,source_key) DO NOTHING RETURNING id INTO signal_id;
  IF signal_id IS NOT NULL AND next_status='pending' THEN
    INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(s.user_id,'SYSTEM_ANNOUNCEMENT','Cópia aguardando aprovação',s.source_name || ' comprou ' || left(p_question,120),jsonb_build_object('source','paper_copy','signal_id',signal_id));
  END IF;
  RETURN signal_id;
END $$;
REVOKE ALL ON FUNCTION public.create_paper_copy_signal(uuid,text,text,text,text,numeric,numeric,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_paper_copy_signal(uuid,text,text,text,text,numeric,numeric,timestamptz) TO service_role;
CREATE FUNCTION public.respond_paper_copy_signal(p_signal uuid,p_accept boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.paper_copy_signals x SET status=CASE WHEN p_accept THEN 'approved' ELSE 'rejected' END FROM public.paper_copy_strategies s WHERE x.id=p_signal AND x.strategy_id=s.id AND s.user_id=auth.uid() AND s.active AND x.source_at>=s.started_at AND s.round_id=(SELECT round_id FROM public.polymarket_paper_wallets WHERE user_id=s.user_id) AND x.status='pending' AND x.created_at > now()-interval '1 hour';
  IF NOT FOUND THEN RAISE EXCEPTION 'Sinal indisponível ou expirado'; END IF;
END $$;
-- The quote is obtained by the trusted worker from Gamma and the live order book.
-- Locking the strategy makes the total cap and paper execution one transaction.
CREATE FUNCTION public.execute_paper_copy_signal(p_signal uuid,p_token text,p_price numeric,p_shares numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.paper_copy_strategies; x public.paper_copy_signals; w public.polymarket_paper_wallets; cost numeric; v_result jsonb; copy_user uuid;
BEGIN
  SELECT strategy_row.user_id INTO copy_user FROM public.paper_copy_signals signal_row JOIN public.paper_copy_strategies strategy_row ON strategy_row.id=signal_row.strategy_id WHERE signal_row.id=p_signal;
  IF copy_user IS NULL THEN RAISE EXCEPTION 'Sinal não encontrado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(copy_user::text, 190711));
  SELECT * INTO x FROM public.paper_copy_signals WHERE id=p_signal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sinal não encontrado'; END IF;
  IF x.status='executed' THEN RETURN x.result; END IF;
  SELECT * INTO s FROM public.paper_copy_strategies WHERE id=x.strategy_id FOR UPDATE;
  IF NOT FOUND OR NOT s.active OR x.status <> 'approved' OR x.source_at < s.started_at OR x.created_at <= now()-interval '1 hour' THEN RAISE EXCEPTION 'Estratégia ou sinal indisponível'; END IF;
  IF s.source_kind='paper' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id::text=s.source_id AND is_public AND show_trades) THEN RAISE EXCEPTION 'Trader não está mais disponível'; END IF;
  IF p_price IS NULL OR p_shares IS NULL OR p_price <= 0 OR p_price > least(1,x.source_price+s.max_price_deviation) OR p_shares <= 0 OR p_shares > 1000000 THEN RAISE EXCEPTION 'Cotação inválida'; END IF;
  cost := round(p_price*p_shares,6);
  IF cost <= 0 OR cost > s.per_trade_limit OR cost > s.total_limit-s.spent_usd OR cost > x.source_notional THEN RAISE EXCEPTION 'Limite de cópia excedido'; END IF;
  INSERT INTO public.polymarket_paper_wallets(user_id) VALUES(s.user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.polymarket_paper_wallets WHERE user_id=s.user_id FOR UPDATE;
  IF w.round_id <> s.round_id THEN RAISE EXCEPTION 'Carteira reiniciada; reative a estratégia'; END IF;
  v_result := public.execute_verified_paper_trade(s.user_id,x.id,w.round_id,x.market_id,x.question,x.outcome,p_token,'BUY',p_shares,p_price);
  -- The request row is locked by the wallet advisory lock; this is the trade inserted in this transaction.
  UPDATE public.polymarket_paper_trades SET copy_signal_id=x.id WHERE id=(SELECT id FROM public.polymarket_paper_trades WHERE user_id=s.user_id AND market_id=x.market_id AND outcome_label=x.outcome AND side='BUY' AND created_at=now() AND copy_signal_id IS NULL ORDER BY id DESC LIMIT 1);
  IF NOT FOUND THEN RAISE EXCEPTION 'Operação de cópia não localizada'; END IF;
  INSERT INTO public.paper_copy_positions(strategy_id,round_id,market_id,outcome,shares,cost_usd) VALUES(s.id,w.round_id,x.market_id,x.outcome,p_shares,cost)
  ON CONFLICT(strategy_id,round_id,market_id,outcome) DO UPDATE SET shares=paper_copy_positions.shares+EXCLUDED.shares,cost_usd=paper_copy_positions.cost_usd+EXCLUDED.cost_usd;
  UPDATE public.paper_copy_strategies SET spent_usd=spent_usd+cost,updated_at=now() WHERE id=s.id;
  UPDATE public.paper_copy_signals SET status='executed',result=v_result WHERE id=x.id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.execute_paper_copy_signal(uuid,text,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_paper_copy_signal(uuid,text,numeric,numeric) TO service_role;
-- Allocate every normal sale proportionally across copied and independently bought shares.
CREATE FUNCTION public.allocate_paper_copy_sale() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE remaining numeric; previous_total numeric; item record; qty numeric; removed_cost numeric;
BEGIN
  IF NEW.side <> 'SELL' THEN RETURN NEW; END IF;
  SELECT shares INTO remaining FROM public.polymarket_paper_positions WHERE user_id=NEW.user_id AND market_id=NEW.market_id AND outcome_label=NEW.outcome_label;
  previous_total := coalesce(remaining,0)+NEW.shares;
  FOR item IN SELECT cp.* FROM public.paper_copy_positions cp JOIN public.paper_copy_strategies s ON s.id=cp.strategy_id JOIN public.polymarket_paper_wallets w ON w.user_id=s.user_id AND w.round_id=cp.round_id WHERE s.user_id=NEW.user_id AND cp.market_id=NEW.market_id AND cp.outcome=NEW.outcome_label AND cp.shares>0 FOR UPDATE OF cp LOOP
    qty := CASE WHEN NEW.shares=previous_total THEN item.shares ELSE trunc(item.shares*NEW.shares/previous_total,6) END;
    IF qty > 0 THEN
      removed_cost := CASE WHEN qty=item.shares THEN item.cost_usd ELSE round(item.cost_usd*qty/item.shares,6) END;
      UPDATE public.paper_copy_positions SET shares=shares-qty,cost_usd=greatest(0,cost_usd-removed_cost),realized_usd=realized_usd+round(qty*NEW.price,6)-removed_cost WHERE strategy_id=item.strategy_id AND round_id=item.round_id AND market_id=item.market_id AND outcome=item.outcome;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.allocate_paper_copy_sale() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER allocate_paper_copy_sale AFTER INSERT ON public.polymarket_paper_trades FOR EACH ROW EXECUTE FUNCTION public.allocate_paper_copy_sale();
CREATE FUNCTION public.pause_copy_on_wallet_reset() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.round_id IS DISTINCT FROM OLD.round_id THEN
    UPDATE public.paper_copy_signals x SET status='skipped',reason='Carteira reiniciada' FROM public.paper_copy_strategies s WHERE x.strategy_id=s.id AND s.user_id=NEW.user_id AND x.status IN ('pending','approved');
    UPDATE public.paper_copy_strategies SET active=false,updated_at=now() WHERE user_id=NEW.user_id AND active;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pause_copy_on_wallet_reset() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pause_copy_on_wallet_reset AFTER UPDATE OF round_id ON public.polymarket_paper_wallets FOR EACH ROW EXECUTE FUNCTION public.pause_copy_on_wallet_reset();
REVOKE ALL ON FUNCTION public.save_paper_copy_strategy(text,text,text,text,numeric,numeric), public.set_paper_copy_active(uuid,boolean), public.respond_paper_copy_signal(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_paper_copy_strategy(text,text,text,text,numeric,numeric), public.set_paper_copy_active(uuid,boolean), public.respond_paper_copy_signal(uuid,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
