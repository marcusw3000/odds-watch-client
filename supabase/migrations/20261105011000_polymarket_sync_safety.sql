-- A lease prevents overlapping cron invocations from advancing the same cursor.
ALTER TABLE public.polymarket_catalog_sync_state
  ADD COLUMN IF NOT EXISTS lease_owner uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_cycle_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_last_cycle_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_pending_events jsonb,
  ADD COLUMN IF NOT EXISTS event_pending_refs jsonb,
  ADD COLUMN IF NOT EXISTS event_pending_next_cursor text,
  ADD COLUMN IF NOT EXISTS event_pending_offset integer NOT NULL DEFAULT 0;

ALTER TABLE public.polymarket_market_cache
  ADD COLUMN IF NOT EXISTS status_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS polymarket_market_status_check_idx
  ON public.polymarket_market_cache (source, status_checked_at ASC NULLS FIRST, market_id);

ALTER TABLE public.polymarket_event_cache ADD COLUMN IF NOT EXISTS status_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS polymarket_event_status_check_idx
  ON public.polymarket_event_cache (source, status_checked_at ASC NULLS FIRST, event_id);

CREATE OR REPLACE FUNCTION public.polymarket_acquire_sync_lease(p_owner uuid)
RETURNS SETOF public.polymarket_catalog_sync_state
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.polymarket_catalog_sync_state
  SET lease_owner = p_owner, lease_expires_at = now() + interval '3 minutes', updated_at = now()
  WHERE source = 'polymarket'
    AND (lease_owner IS NULL OR lease_expires_at IS NULL OR lease_expires_at < now())
  RETURNING *;
$$;

-- Commit each batch and its cursor in one transaction. A worker whose lease
-- expired cannot write or move the cursor after a newer worker has taken over.
CREATE OR REPLACE FUNCTION public.polymarket_commit_sync_page(
  p_owner uuid, p_markets jsonb, p_next_cursor text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_state public.polymarket_catalog_sync_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state FROM public.polymarket_catalog_sync_state
    WHERE source = 'polymarket' FOR UPDATE;
  IF NOT FOUND OR v_state.lease_owner IS DISTINCT FROM p_owner OR v_state.lease_expires_at IS NULL OR v_state.lease_expires_at <= now() THEN
    RETURN false;
  END IF;
  INSERT INTO public.polymarket_market_cache (
    source, market_id, slug, question, description, image_url, condition_id,
    protocol_version, outcomes, volume_usd, liquidity_usd, spread, end_date,
    source_updated_at, accepting_orders, restricted, category, market_status,
    source_payload, synced_at
  )
  SELECT source, market_id, slug, question, description, image_url, condition_id,
    protocol_version, outcomes, volume_usd, liquidity_usd, spread, end_date,
    source_updated_at, accepting_orders, restricted, category, market_status,
    source_payload, synced_at
  FROM jsonb_populate_recordset(NULL::public.polymarket_market_cache, p_markets)
  ON CONFLICT (source, market_id) DO UPDATE SET
    slug = EXCLUDED.slug, question = EXCLUDED.question, description = EXCLUDED.description,
    image_url = EXCLUDED.image_url, condition_id = EXCLUDED.condition_id,
    protocol_version = EXCLUDED.protocol_version, outcomes = EXCLUDED.outcomes,
    volume_usd = EXCLUDED.volume_usd, liquidity_usd = EXCLUDED.liquidity_usd,
    spread = EXCLUDED.spread, end_date = EXCLUDED.end_date,
    source_updated_at = EXCLUDED.source_updated_at, accepting_orders = EXCLUDED.accepting_orders,
    restricted = EXCLUDED.restricted, category = COALESCE(EXCLUDED.category, public.polymarket_market_cache.category),
    market_status = EXCLUDED.market_status, source_payload = EXCLUDED.source_payload, synced_at = EXCLUDED.synced_at;

  UPDATE public.polymarket_catalog_sync_state SET
    cycle_started_at = CASE WHEN v_state.next_cursor IS NULL THEN now() ELSE cycle_started_at END,
    last_cycle_completed_at = CASE WHEN p_next_cursor IS NULL THEN now() ELSE last_cycle_completed_at END,
    next_cursor = p_next_cursor, last_success_at = now(), last_error = NULL,
    lease_expires_at = now() + interval '3 minutes', updated_at = now()
  WHERE source = 'polymarket';
  RETURN true;
END;
$$;

-- Only statuses explicitly returned by Gamma are changed; missing IDs are
-- checked again in a later rotation and are never interpreted as closed.
CREATE OR REPLACE FUNCTION public.polymarket_reconcile_statuses(
  p_owner uuid, p_attempted_ids text[], p_confirmed jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_state public.polymarket_catalog_sync_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state FROM public.polymarket_catalog_sync_state
    WHERE source = 'polymarket' FOR UPDATE;
  IF NOT FOUND OR v_state.lease_owner IS DISTINCT FROM p_owner OR v_state.lease_expires_at IS NULL OR v_state.lease_expires_at <= now() THEN
    RETURN false;
  END IF;
  UPDATE public.polymarket_market_cache SET status_checked_at = now()
    WHERE source = 'polymarket' AND market_id = ANY(p_attempted_ids);
  UPDATE public.polymarket_market_cache AS m SET
    market_status = CASE WHEN x.closed THEN 'closed' ELSE 'open' END,
    accepting_orders = CASE WHEN x.closed THEN false ELSE COALESCE(x.accepting_orders, m.accepting_orders) END
  FROM jsonb_to_recordset(p_confirmed) AS x(market_id text, closed boolean, accepting_orders boolean)
  WHERE m.source = 'polymarket' AND m.market_id = x.market_id
    AND x.market_id = ANY(p_attempted_ids) AND x.closed IS NOT NULL;
  UPDATE public.polymarket_catalog_sync_state SET lease_expires_at = now() + interval '3 minutes'
    WHERE source = 'polymarket';
  RETURN true;
END;
$$;

-- An event page can contain thousands of markets. Each chunk is committed
-- under the same lease; its cursor advances only after the last chunk succeeds.
CREATE OR REPLACE FUNCTION public.polymarket_commit_event_chunk(
  p_owner uuid, p_events jsonb, p_markets jsonb, p_next_cursor text, p_finalize boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_state public.polymarket_catalog_sync_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state FROM public.polymarket_catalog_sync_state
    WHERE source = 'polymarket' FOR UPDATE;
  IF NOT FOUND OR v_state.lease_owner IS DISTINCT FROM p_owner OR v_state.lease_expires_at IS NULL OR v_state.lease_expires_at <= now() THEN RETURN false; END IF;

  INSERT INTO public.polymarket_event_cache (source, event_id, slug, title, search_text, description, image_url,
    volume_usd, volume_24h_usd, liquidity_usd, end_date, source_updated_at, event_status, tags, source_payload, synced_at)
  SELECT source, event_id, slug, title, search_text, description, image_url,
    volume_usd, volume_24h_usd, liquidity_usd, end_date, source_updated_at, event_status, tags, source_payload, synced_at
  FROM jsonb_populate_recordset(NULL::public.polymarket_event_cache, p_events)
  ON CONFLICT (source, event_id) DO UPDATE SET
    slug = EXCLUDED.slug, title = EXCLUDED.title, search_text = EXCLUDED.search_text, description = EXCLUDED.description,
    image_url = EXCLUDED.image_url, volume_usd = EXCLUDED.volume_usd, volume_24h_usd = EXCLUDED.volume_24h_usd,
    liquidity_usd = EXCLUDED.liquidity_usd, end_date = EXCLUDED.end_date, source_updated_at = EXCLUDED.source_updated_at,
    event_status = EXCLUDED.event_status, tags = EXCLUDED.tags, source_payload = EXCLUDED.source_payload, synced_at = EXCLUDED.synced_at;

  INSERT INTO public.polymarket_market_cache (source, market_id, event_id, slug, question, description, image_url, condition_id,
    protocol_version, outcomes, volume_usd, liquidity_usd, spread, end_date, source_updated_at,
    accepting_orders, restricted, category, market_status, source_payload, synced_at)
  SELECT source, market_id, event_id, slug, question, description, image_url, condition_id,
    protocol_version, outcomes, volume_usd, liquidity_usd, spread, end_date, source_updated_at,
    accepting_orders, restricted, category, market_status, source_payload, synced_at
  FROM jsonb_populate_recordset(NULL::public.polymarket_market_cache, p_markets)
  ON CONFLICT (source, market_id) DO UPDATE SET
    event_id = EXCLUDED.event_id, slug = EXCLUDED.slug, question = EXCLUDED.question,
    description = EXCLUDED.description, image_url = EXCLUDED.image_url, condition_id = EXCLUDED.condition_id,
    protocol_version = EXCLUDED.protocol_version, outcomes = EXCLUDED.outcomes, volume_usd = EXCLUDED.volume_usd,
    liquidity_usd = EXCLUDED.liquidity_usd, spread = EXCLUDED.spread, end_date = EXCLUDED.end_date,
    source_updated_at = EXCLUDED.source_updated_at, accepting_orders = EXCLUDED.accepting_orders,
    restricted = EXCLUDED.restricted, category = COALESCE(EXCLUDED.category, public.polymarket_market_cache.category),
    market_status = EXCLUDED.market_status, source_payload = EXCLUDED.source_payload, synced_at = EXCLUDED.synced_at;

  UPDATE public.polymarket_catalog_sync_state SET
    event_cycle_started_at = CASE WHEN p_finalize AND v_state.event_next_cursor IS NULL THEN now() ELSE event_cycle_started_at END,
    event_last_cycle_completed_at = CASE WHEN p_finalize AND p_next_cursor IS NULL THEN now() ELSE event_last_cycle_completed_at END,
    event_next_cursor = CASE WHEN p_finalize THEN p_next_cursor ELSE event_next_cursor END,
    last_success_at = now(), last_error = NULL, lease_expires_at = now() + interval '3 minutes', updated_at = now()
  WHERE source = 'polymarket';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.polymarket_reconcile_event_statuses(
  p_owner uuid, p_attempted_ids text[], p_confirmed jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_state public.polymarket_catalog_sync_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state FROM public.polymarket_catalog_sync_state WHERE source = 'polymarket' FOR UPDATE;
  IF NOT FOUND OR v_state.lease_owner IS DISTINCT FROM p_owner OR v_state.lease_expires_at IS NULL OR v_state.lease_expires_at <= now() THEN RETURN false; END IF;
  UPDATE public.polymarket_event_cache SET status_checked_at = now()
    WHERE source = 'polymarket' AND event_id = ANY(p_attempted_ids);
  UPDATE public.polymarket_event_cache AS e SET event_status = CASE WHEN x.closed THEN 'closed' ELSE 'open' END
  FROM jsonb_to_recordset(p_confirmed) AS x(event_id text, closed boolean)
  WHERE e.source = 'polymarket' AND e.event_id = x.event_id AND x.event_id = ANY(p_attempted_ids) AND x.closed IS NOT NULL;
  UPDATE public.polymarket_catalog_sync_state SET lease_expires_at = now() + interval '3 minutes' WHERE source = 'polymarket';
  RETURN true;
END;
$$;

-- Stage immutable market IDs for the current event page. If execution times
-- out between chunks, the next worker resumes the exact same set of IDs.
CREATE OR REPLACE FUNCTION public.polymarket_stage_event_page(
  p_owner uuid, p_events jsonb, p_refs jsonb, p_next_cursor text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_state public.polymarket_catalog_sync_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state FROM public.polymarket_catalog_sync_state WHERE source = 'polymarket' FOR UPDATE;
  IF NOT FOUND OR v_state.lease_owner IS DISTINCT FROM p_owner OR v_state.lease_expires_at IS NULL OR v_state.lease_expires_at <= now() OR v_state.event_pending_refs IS NOT NULL THEN RETURN false; END IF;
  UPDATE public.polymarket_catalog_sync_state SET event_pending_events = p_events,
    event_pending_refs = p_refs, event_pending_next_cursor = p_next_cursor, event_pending_offset = 0,
    lease_expires_at = now() + interval '3 minutes', updated_at = now() WHERE source = 'polymarket';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.polymarket_commit_staged_event_chunk(
  p_owner uuid, p_offset integer, p_markets jsonb, p_count integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_state public.polymarket_catalog_sync_state%ROWTYPE; v_final boolean; v_ok boolean;
BEGIN
  SELECT * INTO v_state FROM public.polymarket_catalog_sync_state WHERE source = 'polymarket' FOR UPDATE;
  IF NOT FOUND OR v_state.lease_owner IS DISTINCT FROM p_owner OR v_state.lease_expires_at IS NULL OR v_state.lease_expires_at <= now()
    OR v_state.event_pending_refs IS NULL OR v_state.event_pending_offset <> p_offset
    OR p_count < 0 OR p_count > 100 OR p_offset + p_count > jsonb_array_length(v_state.event_pending_refs)
    OR jsonb_array_length(p_markets) <> p_count THEN RETURN false; END IF;
  IF p_count = 0 AND jsonb_array_length(v_state.event_pending_refs) <> 0 THEN RETURN false; END IF;
  v_final := p_offset + p_count = jsonb_array_length(v_state.event_pending_refs);
  v_ok := public.polymarket_commit_event_chunk(p_owner,
    CASE WHEN p_offset = 0 THEN v_state.event_pending_events ELSE '[]'::jsonb END,
    p_markets, v_state.event_pending_next_cursor, v_final);
  IF NOT v_ok THEN RETURN false; END IF;
  UPDATE public.polymarket_catalog_sync_state SET
    event_pending_offset = CASE WHEN v_final THEN 0 ELSE p_offset + p_count END,
    event_pending_events = CASE WHEN v_final THEN NULL ELSE event_pending_events END,
    event_pending_refs = CASE WHEN v_final THEN NULL ELSE event_pending_refs END,
    event_pending_next_cursor = CASE WHEN v_final THEN NULL ELSE event_pending_next_cursor END
  WHERE source = 'polymarket';
  RETURN true;
END;
$$;

CREATE OR REPLACE VIEW public.polymarket_catalog_sync_public AS
  SELECT source, cycle_started_at, last_cycle_completed_at, last_success_at, updated_at,
    event_cycle_started_at, event_last_cycle_completed_at
  FROM public.polymarket_catalog_sync_state WHERE source = 'polymarket';
GRANT SELECT ON public.polymarket_catalog_sync_public TO anon, authenticated;

REVOKE ALL ON FUNCTION public.polymarket_acquire_sync_lease(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.polymarket_commit_sync_page(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.polymarket_reconcile_statuses(uuid, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.polymarket_commit_event_chunk(uuid, jsonb, jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.polymarket_reconcile_event_statuses(uuid, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.polymarket_stage_event_page(uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.polymarket_commit_staged_event_chunk(uuid, integer, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.polymarket_acquire_sync_lease(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.polymarket_commit_sync_page(uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.polymarket_reconcile_statuses(uuid, text[], jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.polymarket_commit_event_chunk(uuid, jsonb, jsonb, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.polymarket_reconcile_event_statuses(uuid, text[], jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.polymarket_stage_event_page(uuid, jsonb, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.polymarket_commit_staged_event_chunk(uuid, integer, jsonb, integer) TO service_role;
