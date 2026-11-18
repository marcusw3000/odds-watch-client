\set ON_ERROR_STOP on
\i /base-test.sql
CREATE ROLE service_role;
\i /disk.sql
SELECT public.record_disk_health(85);
SELECT public.record_disk_health(85);
DO $$ BEGIN IF (SELECT count(*) FROM public.notifications WHERE data->>'alert_key'='disk_usage') <> 1 THEN RAISE EXCEPTION 'disk deduplication failed'; END IF; END $$;
SELECT public.record_disk_health(50);
SELECT public.record_disk_health(85);
DO $$ BEGIN IF (SELECT count(*) FROM public.notifications WHERE data->>'alert_key'='disk_usage') <> 2 THEN RAISE EXCEPTION 'disk recovery failed'; END IF; END $$;
ALTER TABLE public.polymarket_catalog_sync_state ADD COLUMN cycle_started_at timestamptz, ADD COLUMN last_cycle_completed_at timestamptz, ADD COLUMN event_cycle_started_at timestamptz, ADD COLUMN event_last_cycle_completed_at timestamptz;
\i /cycle.sql
UPDATE public.polymarket_catalog_sync_state SET cycle_started_at='2026-01-01 00:00:00+00',last_cycle_completed_at='2026-01-01 00:00:05+00';
DO $$ BEGIN IF (SELECT last_market_cycle_duration_ms FROM public.polymarket_catalog_sync_state WHERE source='polymarket') <> 5000 THEN RAISE EXCEPTION 'cycle duration failed'; END IF; END $$;
