-- Run on a disposable database. This test changes no persistent data.
BEGIN;
INSERT INTO public.polymarket_catalog_sync_state(source) VALUES ('polymarket') ON CONFLICT (source) DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.polymarket_catalog_sync_public'::regclass AND reloptions @> ARRAY['security_invoker=true']) THEN RAISE EXCEPTION 'View must use invoker privileges'; END IF;
  IF has_column_privilege('anon','public.polymarket_catalog_sync_state','next_cursor','SELECT') OR has_column_privilege('authenticated','public.polymarket_catalog_sync_state','last_error','SELECT') THEN RAISE EXCEPTION 'Private sync metadata exposed'; END IF;
END $$;
SET LOCAL ROLE anon;
SELECT source,last_success_at,last_cycle_completed_at,event_last_cycle_completed_at FROM public.polymarket_catalog_sync_public;
DO $$ BEGIN
  IF (SELECT count(source) FROM public.polymarket_catalog_sync_public WHERE source='polymarket') <> 1 THEN RAISE EXCEPTION 'Anonymous view cannot read sync status'; END IF;
  BEGIN PERFORM next_cursor FROM public.polymarket_catalog_sync_state; RAISE EXCEPTION 'Cursor leaked'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT source,last_success_at FROM public.polymarket_catalog_sync_public;
ROLLBACK;
