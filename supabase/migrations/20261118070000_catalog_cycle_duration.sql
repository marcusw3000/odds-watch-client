ALTER TABLE public.polymarket_catalog_sync_state ADD COLUMN IF NOT EXISTS last_market_cycle_duration_ms bigint;
ALTER TABLE public.polymarket_catalog_sync_state ADD COLUMN IF NOT EXISTS last_event_cycle_duration_ms bigint;

CREATE FUNCTION public.capture_catalog_cycle_duration() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.last_cycle_completed_at IS DISTINCT FROM OLD.last_cycle_completed_at AND NEW.last_cycle_completed_at IS NOT NULL THEN
    IF NEW.cycle_started_at IS NOT NULL AND NEW.cycle_started_at <= NEW.last_cycle_completed_at THEN
      NEW.last_market_cycle_duration_ms := greatest(0, floor(extract(epoch FROM (NEW.last_cycle_completed_at - NEW.cycle_started_at))*1000)::bigint);
    ELSE NEW.last_market_cycle_duration_ms := NULL; END IF;
  END IF;
  IF NEW.event_last_cycle_completed_at IS DISTINCT FROM OLD.event_last_cycle_completed_at AND NEW.event_last_cycle_completed_at IS NOT NULL THEN
    IF NEW.event_cycle_started_at IS NOT NULL AND NEW.event_cycle_started_at <= NEW.event_last_cycle_completed_at THEN
      NEW.last_event_cycle_duration_ms := greatest(0, floor(extract(epoch FROM (NEW.event_last_cycle_completed_at - NEW.event_cycle_started_at))*1000)::bigint);
    ELSE NEW.last_event_cycle_duration_ms := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capture_catalog_cycle_duration BEFORE UPDATE ON public.polymarket_catalog_sync_state FOR EACH ROW EXECUTE FUNCTION public.capture_catalog_cycle_duration();
REVOKE ALL ON FUNCTION public.capture_catalog_cycle_duration() FROM PUBLIC,anon,authenticated;
