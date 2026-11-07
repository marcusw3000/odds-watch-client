ALTER TABLE public.paper_copy_signals ADD COLUMN side text NOT NULL DEFAULT 'BUY' CHECK (side IN ('BUY','SELL')),
  ADD COLUMN source_shares numeric(18,6), ADD COLUMN source_position_before numeric(18,6), ADD COLUMN sell_fraction numeric(18,12);
ALTER TABLE public.polymarket_paper_trades ADD COLUMN position_before numeric(18,6);

CREATE FUNCTION public.capture_paper_sale_position() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE remaining numeric;
BEGIN
  IF NEW.side='SELL' THEN
    SELECT shares INTO remaining FROM public.polymarket_paper_positions WHERE user_id=NEW.user_id AND market_id=NEW.market_id AND outcome_label=NEW.outcome_label;
    UPDATE public.polymarket_paper_trades SET position_before=coalesce(remaining,0)+NEW.shares WHERE id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_paper_sale_position() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_paper_sale_position AFTER INSERT ON public.polymarket_paper_trades FOR EACH ROW EXECUTE FUNCTION public.capture_paper_sale_position();

CREATE FUNCTION public.create_paper_copy_sale_signal(p_strategy uuid,p_key text,p_market text,p_question text,p_outcome text,p_price numeric,p_notional numeric,p_at timestamptz,p_shares numeric,p_before numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.paper_copy_strategies; signal_id uuid; next_status text; copy_qty numeric; pending_buy boolean;
BEGIN
  SELECT * INTO s FROM public.paper_copy_strategies WHERE id=p_strategy FOR UPDATE;
  IF NOT FOUND OR NOT s.active OR p_at<s.started_at OR p_at>now()+interval '1 minute' THEN RETURN NULL; END IF;
  IF s.source_kind='paper' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id::text=s.source_id AND is_public AND show_trades) THEN RETURN NULL; END IF;
  IF p_shares IS NULL OR p_before IS NULL OR p_shares<=0 OR p_before<p_shares OR p_shares::text IN ('NaN','Infinity','-Infinity') OR p_before::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Posição de origem indisponível'; END IF;
  SELECT shares INTO copy_qty FROM public.paper_copy_positions WHERE strategy_id=s.id AND round_id=s.round_id AND market_id=p_market AND outcome=p_outcome;
  SELECT EXISTS(SELECT 1 FROM public.paper_copy_signals WHERE strategy_id=s.id AND market_id=p_market AND outcome=p_outcome AND side='BUY' AND status IN ('pending','approved') AND source_at<=p_at) INTO pending_buy;
  next_status:=CASE WHEN p_at<now()-interval '15 minutes' OR (coalesce(copy_qty,0)<=0 AND NOT pending_buy) THEN 'skipped' WHEN s.mode='automatic' THEN 'approved' ELSE 'pending' END;
  INSERT INTO public.paper_copy_signals(strategy_id,source_key,market_id,question,outcome,source_price,source_notional,source_at,status,side,source_shares,source_position_before,sell_fraction,reason)
    VALUES(s.id,p_key,p_market,p_question,p_outcome,p_price,p_notional,p_at,next_status,'SELL',p_shares,p_before,least(1,p_shares/p_before),CASE WHEN p_at<now()-interval '15 minutes' THEN 'Sinal recebido com atraso superior a 15 minutos' WHEN coalesce(copy_qty,0)<=0 AND NOT pending_buy THEN 'Nenhuma posição copiada disponível' END)
    ON CONFLICT(strategy_id,source_key) DO NOTHING RETURNING id INTO signal_id;
  IF signal_id IS NOT NULL AND next_status='pending' THEN INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(s.user_id,'SYSTEM_ANNOUNCEMENT','Venda copiada aguardando aprovação',s.source_name || ' vendeu ' || left(p_question,120),jsonb_build_object('source','paper_copy','signal_id',signal_id)); END IF;
  RETURN signal_id;
END $$;
REVOKE ALL ON FUNCTION public.create_paper_copy_sale_signal(uuid,text,text,text,text,numeric,numeric,timestamptz,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_paper_copy_sale_signal(uuid,text,text,text,text,numeric,numeric,timestamptz,numeric,numeric) TO service_role;
CREATE FUNCTION public.record_paper_copy_unavailable_sale(p_strategy uuid,p_key text,p_market text,p_question text,p_outcome text,p_price numeric,p_notional numeric,p_at timestamptz,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.paper_copy_strategies;
BEGIN
  SELECT * INTO s FROM public.paper_copy_strategies WHERE id=p_strategy FOR UPDATE;
  IF NOT FOUND OR NOT s.active OR p_at<s.started_at OR p_at>now()+interval '1 minute' THEN RETURN; END IF;
  IF s.source_kind='paper' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id::text=s.source_id AND is_public AND show_trades) THEN RETURN; END IF;
  INSERT INTO public.paper_copy_signals(strategy_id,source_key,market_id,question,outcome,source_price,source_notional,source_at,status,side,reason)
    VALUES(s.id,p_key,p_market,p_question,p_outcome,p_price,p_notional,p_at,'skipped','SELL',left(coalesce(p_reason,'Posição de origem indisponível'),240)) ON CONFLICT(strategy_id,source_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.record_paper_copy_unavailable_sale(uuid,text,text,text,text,numeric,numeric,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_paper_copy_unavailable_sale(uuid,text,text,text,text,numeric,numeric,timestamptz,text) TO service_role;

CREATE OR REPLACE FUNCTION public.allocate_paper_copy_sale() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE remaining numeric; previous_total numeric; item record; qty numeric; removed_cost numeric; target uuid;
BEGIN
  IF NEW.side <> 'SELL' THEN RETURN NEW; END IF;
  target:=nullif(current_setting('app.paper_copy_sell_strategy',true),'')::uuid;
  SELECT shares INTO remaining FROM public.polymarket_paper_positions WHERE user_id=NEW.user_id AND market_id=NEW.market_id AND outcome_label=NEW.outcome_label;
  previous_total:=coalesce(remaining,0)+NEW.shares;
  FOR item IN SELECT cp.* FROM public.paper_copy_positions cp JOIN public.paper_copy_strategies s ON s.id=cp.strategy_id JOIN public.polymarket_paper_wallets w ON w.user_id=s.user_id AND w.round_id=cp.round_id WHERE s.user_id=NEW.user_id AND cp.market_id=NEW.market_id AND cp.outcome=NEW.outcome_label AND cp.shares>0 AND (target IS NULL OR cp.strategy_id=target) FOR UPDATE OF cp LOOP
    qty:=CASE WHEN target IS NOT NULL THEN NEW.shares WHEN NEW.shares=previous_total THEN item.shares ELSE trunc(item.shares*NEW.shares/previous_total,6) END;
    IF qty>item.shares THEN RAISE EXCEPTION 'Shares copiadas insuficientes'; END IF;
    IF qty>0 THEN
      removed_cost:=CASE WHEN qty=item.shares THEN item.cost_usd ELSE round(item.cost_usd*qty/item.shares,6) END;
      UPDATE public.paper_copy_positions SET shares=shares-qty,cost_usd=greatest(0,cost_usd-removed_cost),realized_usd=realized_usd+round(qty*NEW.price,6)-removed_cost WHERE strategy_id=item.strategy_id AND round_id=item.round_id AND market_id=item.market_id AND outcome=item.outcome;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.execute_paper_copy_signal(p_signal uuid,p_token text,p_price numeric,p_shares numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.paper_copy_strategies; x public.paper_copy_signals; w public.polymarket_paper_wallets; cost numeric; v_result jsonb; copy_user uuid; copy_qty numeric; max_sale numeric;
BEGIN
  SELECT st.user_id INTO copy_user FROM public.paper_copy_signals sig JOIN public.paper_copy_strategies st ON st.id=sig.strategy_id WHERE sig.id=p_signal;
  IF copy_user IS NULL THEN RAISE EXCEPTION 'Sinal não encontrado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(copy_user::text,190711));
  SELECT * INTO x FROM public.paper_copy_signals WHERE id=p_signal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sinal não encontrado'; END IF;
  IF x.status='executed' THEN RETURN x.result; END IF;
  SELECT * INTO s FROM public.paper_copy_strategies WHERE id=x.strategy_id FOR UPDATE;
  IF NOT FOUND OR NOT s.active OR x.status<>'approved' OR x.source_at<s.started_at OR x.created_at<=now()-interval '1 hour' THEN RAISE EXCEPTION 'Estratégia ou sinal indisponível'; END IF;
  IF s.source_kind='paper' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id::text=s.source_id AND is_public AND show_trades) THEN RAISE EXCEPTION 'Trader não está mais disponível'; END IF;
  IF p_price IS NULL OR p_shares IS NULL OR p_price<=0 OR p_price>1 OR p_shares<=0 OR p_shares>1000000 THEN RAISE EXCEPTION 'Cotação inválida'; END IF;
  cost:=round(p_price*p_shares,6);
  IF x.side='BUY' THEN
    IF p_price>least(1,x.source_price+s.max_price_deviation) OR cost<=0 OR cost>s.per_trade_limit OR cost>s.total_limit-s.spent_usd OR cost>x.source_notional THEN RAISE EXCEPTION 'Limite de cópia excedido'; END IF;
  ELSE
    SELECT shares INTO copy_qty FROM public.paper_copy_positions WHERE strategy_id=s.id AND round_id=s.round_id AND market_id=x.market_id AND outcome=x.outcome FOR UPDATE;
    max_sale:=trunc(coalesce(copy_qty,0)*x.sell_fraction,6);
    IF p_price<greatest(0.000001,x.source_price-s.max_price_deviation) OR cost<=0 OR max_sale<=0 OR p_shares>max_sale THEN RAISE EXCEPTION 'Shares copiadas ou cotação insuficientes'; END IF;
  END IF;
  INSERT INTO public.polymarket_paper_wallets(user_id) VALUES(s.user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.polymarket_paper_wallets WHERE user_id=s.user_id FOR UPDATE;
  IF w.round_id<>s.round_id THEN RAISE EXCEPTION 'Carteira reiniciada; reative a estratégia'; END IF;
  IF x.side='SELL' THEN PERFORM set_config('app.paper_copy_sell_strategy',s.id::text,true); END IF;
  v_result:=public.execute_verified_paper_trade(s.user_id,x.id,w.round_id,x.market_id,x.question,x.outcome,p_token,x.side,p_shares,p_price);
  IF x.side='SELL' THEN PERFORM set_config('app.paper_copy_sell_strategy','',true); END IF;
  UPDATE public.polymarket_paper_trades SET copy_signal_id=x.id WHERE id=(SELECT id FROM public.polymarket_paper_trades WHERE user_id=s.user_id AND market_id=x.market_id AND outcome_label=x.outcome AND side=x.side AND created_at=now() AND copy_signal_id IS NULL ORDER BY id DESC LIMIT 1);
  IF NOT FOUND THEN RAISE EXCEPTION 'Operação de cópia não localizada'; END IF;
  IF x.side='BUY' THEN
    INSERT INTO public.paper_copy_positions(strategy_id,round_id,market_id,outcome,shares,cost_usd) VALUES(s.id,w.round_id,x.market_id,x.outcome,p_shares,cost) ON CONFLICT(strategy_id,round_id,market_id,outcome) DO UPDATE SET shares=paper_copy_positions.shares+EXCLUDED.shares,cost_usd=paper_copy_positions.cost_usd+EXCLUDED.cost_usd;
    UPDATE public.paper_copy_strategies SET spent_usd=spent_usd+cost,updated_at=now() WHERE id=s.id;
  END IF;
  UPDATE public.paper_copy_signals SET status='executed',result=v_result WHERE id=x.id;
  RETURN v_result;
END $$;
NOTIFY pgrst,'reload schema';
