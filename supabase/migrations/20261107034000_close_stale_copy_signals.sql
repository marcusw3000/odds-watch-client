CREATE FUNCTION public.close_stale_copy_signals() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF (OLD.active AND NOT NEW.active) OR OLD.mode IS DISTINCT FROM NEW.mode OR OLD.round_id IS DISTINCT FROM NEW.round_id OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    UPDATE public.paper_copy_signals SET status='skipped',reason='Estratégia pausada ou reconfigurada' WHERE strategy_id=NEW.id AND status IN ('pending','approved');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.close_stale_copy_signals() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER close_stale_copy_signals AFTER UPDATE ON public.paper_copy_strategies FOR EACH ROW EXECUTE FUNCTION public.close_stale_copy_signals();
