ALTER TABLE public.paper_copy_strategies ADD COLUMN monitoring_error text, ADD COLUMN last_success_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_paper_copy_active(p_strategy uuid,p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid := auth.uid(); s public.paper_copy_strategies;
BEGIN
  IF uid IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 190711));
  SELECT * INTO s FROM public.paper_copy_strategies WHERE id=p_strategy AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estratégia não encontrada'; END IF;
  IF p_active AND s.round_id IS DISTINCT FROM (SELECT round_id FROM public.polymarket_paper_wallets WHERE user_id=uid) THEN RAISE EXCEPTION 'A carteira foi reiniciada. Edite os limites para ativar uma nova rodada.'; END IF;
  IF p_active AND NOT s.active AND (SELECT count(*) FROM public.paper_copy_strategies WHERE user_id=uid AND active) >= 10 THEN RAISE EXCEPTION 'Limite de estratégias ativas atingido'; END IF;
  IF p_active AND s.source_kind='paper' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id::text=s.source_id AND is_public AND show_trades) THEN RAISE EXCEPTION 'Trader indisponível para cópia'; END IF;
  UPDATE public.paper_copy_strategies SET active=p_active,started_at=CASE WHEN p_active AND NOT active THEN now() ELSE started_at END,monitored_at=CASE WHEN p_active AND NOT active THEN now() ELSE monitored_at END,checked_at=now(),monitoring_error=NULL,updated_at=now() WHERE id=p_strategy AND user_id=uid;
END $$;
