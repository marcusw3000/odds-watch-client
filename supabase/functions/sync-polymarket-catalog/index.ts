import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { fetchPriorityEvents, syncEventPage } from "../_shared/polymarketEvents.ts";
import { fetchConfirmedStatuses } from "../_shared/polymarketStatus.ts";

const GAMMA_API_URL = "https://gamma-api.polymarket.com";
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PAGES_PER_RUN = 40;
const MAX_RECONCILE_BATCHES = 5;
const MAX_EVENT_PAGES_PER_RUN = 10;
const MAX_EVENT_RECONCILE_BATCHES = 2;
const TIME_BUDGET_MS = 45_000;

type PendingEventRef = { market_id: string; event_id: string };

async function fetchEventMarkets(refs: PendingEventRef[]) {
  if (!refs.length) return [];
  const url = new URL("/markets", GAMMA_API_URL);
  for (const ref of refs) url.searchParams.append("id", ref.market_id);
  url.searchParams.set("limit", String(refs.length));
  url.searchParams.set("closed", "any");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Gamma event markets request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Gamma returned invalid event markets");
  const records = new Map(payload.flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const market = mapMarket(row as GammaMarket);
    return market ? [[market.market_id, market] as const] : [];
  }));
  // Some inactive markets appear in events but Gamma omits them from /markets
  // even with closed=any. Resolve those IDs individually before checkpointing.
  const missing = refs.filter((ref) => !records.has(ref.market_id));
  for (let offset = 0; offset < missing.length; offset += 8) {
    const batch = missing.slice(offset, offset + 8);
    const recovered = await Promise.all(batch.map(async (ref) => {
      const individual = await fetch(`${GAMMA_API_URL}/markets/${encodeURIComponent(ref.market_id)}`, {
        headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!individual.ok) throw new Error(`Gamma individual market request failed (${individual.status})`);
      const row: unknown = await individual.json();
      const market = row && typeof row === "object" && !Array.isArray(row) ? mapMarket(row as GammaMarket) : null;
      if (!market || market.market_id !== ref.market_id) throw new Error(`Gamma did not confirm market ${ref.market_id}`);
      return market;
    }));
    for (const market of recovered) records.set(market.market_id, market);
  }
  return refs.map((ref) => {
    const market = records.get(ref.market_id);
    // Do not advance past unconfirmed IDs; retry this immutable chunk later.
    if (!market) throw new Error(`Gamma did not return market ${ref.market_id} from staged event page`);
    return { ...market, event_id: ref.event_id };
  });
}

interface GammaMarket {
  id?: unknown;
  slug?: unknown;
  question?: unknown;
  description?: unknown;
  image?: unknown;
  icon?: unknown;
  conditionId?: unknown;
  version?: unknown;
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
  positionIds?: unknown;
  volume?: unknown;
  volumeNum?: unknown;
  liquidity?: unknown;
  liquidityNum?: unknown;
  spread?: unknown;
  endDate?: unknown;
  updatedAt?: unknown;
  acceptingOrders?: unknown;
  restricted?: unknown;
  category?: unknown;
  closed?: unknown;
}

function asText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asIsoDate(value: unknown): string | null {
  const text = asText(value);
  if (!text || Number.isNaN(new Date(text).getTime())) return null;
  return text;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapMarket(record: GammaMarket) {
  const marketId = asText(record.id);
  const question = asText(record.question);
  if (!marketId || !question) return null;

  const labels = parseStringArray(record.outcomes);
  const prices = parseStringArray(record.outcomePrices);
  const tokenIds = parseStringArray(record.clobTokenIds);
  const positionIds = Array.isArray(record.positionIds)
    ? record.positionIds.filter((item): item is string => typeof item === "string") : [];
  const outcomes = labels.map((label, index) => ({
    label,
    price: prices[index] ?? null,
    tokenId: tokenIds[index] ?? null,
    positionId: positionIds[index] ?? null,
  }));

  return {
    source: "polymarket",
    market_id: marketId,
    slug: asText(record.slug),
    question,
    description: asText(record.description),
    image_url: asText(record.image) ?? asText(record.icon),
    condition_id: asText(record.conditionId),
    protocol_version: asText(record.version),
    outcomes,
    volume_usd: asFiniteNumber(record.volume) ?? asFiniteNumber(record.volumeNum),
    liquidity_usd: asFiniteNumber(record.liquidity) ?? asFiniteNumber(record.liquidityNum),
    spread: asFiniteNumber(record.spread),
    end_date: asIsoDate(record.endDate),
    source_updated_at: asIsoDate(record.updatedAt),
    accepting_orders: record.acceptingOrders === true,
    restricted: record.restricted === true,
    category: asText(record.category),
    market_status: record.closed === true ? "closed" : "open",
    // Catalog reads use the normalized columns; retain no duplicate raw payload.
    source_payload: {},
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("POLYMARKET_CRON_SECRET") ?? serviceRoleKey;
  if (!serviceRoleKey || !cronSecret || req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + TIME_BUDGET_MS;
  const owner = crypto.randomUUID();
  let acquired = false;
  let synced = 0;
  let pages = 0;
  let reconciled = 0;
  let eventsSynced = 0;
  let eventPages = 0;
  let eventsReconciled = 0;
  let priorityEvents = 0;
  let partial = false;
  try {
    const { data: lease, error: leaseError } = await supabase.rpc("polymarket_acquire_sync_lease", { p_owner: owner });
    if (leaseError) throw new Error(`Failed to acquire sync lease: ${leaseError.message}`);
    const state = Array.isArray(lease) ? lease[0] : null;
    if (!state) return new Response(JSON.stringify({ success: true, skipped: "sync already running" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    acquired = true;
    let cursor = asText(state.next_cursor);
    let eventCursor = asText(state.event_next_cursor);
    let pendingRefs: PendingEventRef[] | null = Array.isArray(state.event_pending_refs) ? state.event_pending_refs : null;
    let pendingEvents: unknown[] = Array.isArray(state.event_pending_events) ? state.event_pending_events : [];
    let pendingOffset = Number(state.event_pending_offset ?? 0);
    let pendingNextCursor = asText(state.event_pending_next_cursor);

    // Reserve the first slice for market pages so a large event cannot starve
    // this independent cursor. Commit data and cursor together for each page.
    const marketDeadline = Math.min(deadline, Date.now() + 12_000);
    while (pages < MAX_PAGES_PER_RUN && Date.now() < marketDeadline) {
      const url = new URL("/markets/keyset", GAMMA_API_URL);
      url.searchParams.set("closed", "false");
      url.searchParams.set("limit", String(PAGE_SIZE));
      if (cursor) url.searchParams.set("after_cursor", cursor);
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`Gamma request failed (${response.status})`);
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { markets?: unknown }).markets)) throw new Error("Gamma returned an invalid markets response");
      const rawMarkets = (payload as { markets: unknown[] }).markets;
      const markets = rawMarkets.map((record) => record && typeof record === "object" ? mapMarket(record as GammaMarket) : null);
      if (markets.some((market) => !market)) throw new Error("Gamma returned an incomplete market page");
      const nextCursor = asText((payload as { next_cursor?: unknown }).next_cursor);
      if (nextCursor && (nextCursor === cursor || rawMarkets.length === 0)) throw new Error("Gamma returned an invalid next cursor");
      const { data: committed, error: commitError } = await supabase.rpc("polymarket_commit_sync_page", { p_owner: owner, p_markets: markets, p_next_cursor: nextCursor });
      if (commitError || !committed) throw new Error(`Failed to commit catalog page: ${commitError?.message ?? "lease expired"}`);
      pages++;
      synced += markets.length;
      cursor = nextCursor;
      if (!cursor) break;
    }

    // Re-check rotating batches by ID. A missing ID or failed request never
    // causes a cached market to be marked closed.
    for (let batch = 0; batch < MAX_RECONCILE_BATCHES && Date.now() < deadline; batch++) {
      const { data: candidates, error: readError } = await supabase.from("polymarket_market_cache")
        .select("market_id").eq("source", "polymarket")
        .order("status_checked_at", { ascending: true, nullsFirst: true }).order("market_id", { ascending: true }).limit(PAGE_SIZE);
      if (readError) throw new Error(`Failed to read reconciliation candidates: ${readError.message}`);
      const ids = (candidates ?? []).map((row: { market_id: string }) => row.market_id).filter((id: string) => /^\d{1,20}$/.test(id));
      if (!ids.length) break;
      const confirmed = (await fetchConfirmedStatuses("markets", ids, REQUEST_TIMEOUT_MS))
        .map((row) => ({ market_id: row.id, closed: row.closed, accepting_orders: row.acceptingOrders }));
      const { data: committed, error: reconcileError } = await supabase.rpc("polymarket_reconcile_statuses", { p_owner: owner, p_attempted_ids: ids, p_confirmed: confirmed });
      if (reconcileError || !committed) throw new Error(`Failed to reconcile statuses: ${reconcileError?.message ?? "lease expired"}`);
      reconciled += confirmed.length;
    }

    for (let batch = 0; batch < MAX_EVENT_RECONCILE_BATCHES && Date.now() < deadline; batch++) {
      const { data: candidates, error: readError } = await supabase.from("polymarket_event_cache")
        .select("event_id").eq("source", "polymarket")
        .order("status_checked_at", { ascending: true, nullsFirst: true }).order("event_id", { ascending: true }).limit(PAGE_SIZE);
      if (readError) throw new Error(`Failed to read event reconciliation candidates: ${readError.message}`);
      const ids = (candidates ?? []).map((row: { event_id: string }) => row.event_id).filter((id: string) => /^\d{1,20}$/.test(id));
      if (!ids.length) break;
      const confirmed = (await fetchConfirmedStatuses("events", ids, REQUEST_TIMEOUT_MS))
        .map((row) => ({ event_id: row.id, closed: row.closed }));
      const { data: committed, error: reconcileError } = await supabase.rpc("polymarket_reconcile_event_statuses", { p_owner: owner, p_attempted_ids: ids, p_confirmed: confirmed });
      if (reconcileError || !committed) throw new Error(`Failed to reconcile event statuses: ${reconcileError?.message ?? "lease expired"}`);
      eventsReconciled += confirmed.length;
    }

    // Refresh the most active events every run, independently from the full
    // traversal cursor. They are still ordinary public Gamma snapshots.
    if (Date.now() < deadline) {
      const priority = await fetchPriorityEvents(mapMarket, REQUEST_TIMEOUT_MS);
      const priorityMarkets = priority.markets.slice(0, PAGE_SIZE);
      const chunks = Math.max(1, Math.ceil(priorityMarkets.length / PAGE_SIZE));
      for (let chunk = 0; chunk < chunks; chunk++) {
        if (Date.now() >= deadline) { partial = true; break; }
        const { data: committed, error: commitError } = await supabase.rpc("polymarket_commit_event_chunk", {
          p_owner: owner, p_events: chunk === 0 ? priority.events : [],
          p_markets: priorityMarkets.slice(chunk * PAGE_SIZE, (chunk + 1) * PAGE_SIZE),
          p_next_cursor: eventCursor, p_finalize: false,
        });
        if (commitError || !committed) throw new Error(`Failed to commit priority events: ${commitError?.message ?? "lease expired"}`);
      }
      priorityEvents = priority.events.length;
    }

    // Stage immutable references for each page, then checkpoint every chunk.
    // This prevents both missing IDs when Gamma's page changes and starvation
    // on pages too large to finish in one Edge Function invocation.
    while (eventPages < MAX_EVENT_PAGES_PER_RUN && Date.now() < deadline) {
      if (!pendingRefs) {
        const page = await syncEventPage(eventCursor, mapMarket, REQUEST_TIMEOUT_MS);
        if (page.nextCursor && page.events.length === 0) throw new Error("Gamma returned an invalid event cursor");
        pendingRefs = page.markets.map((market) => ({ market_id: String(market.market_id), event_id: String(market.event_id) }));
        pendingEvents = page.events;
        pendingOffset = 0;
        pendingNextCursor = page.nextCursor;
        const { data: staged, error: stageError } = await supabase.rpc("polymarket_stage_event_page", {
          p_owner: owner, p_events: pendingEvents, p_refs: pendingRefs, p_next_cursor: pendingNextCursor,
        });
        if (stageError || !staged) throw new Error(`Failed to stage event page: ${stageError?.message ?? "lease expired or another page pending"}`);
      }
      if (!Number.isInteger(pendingOffset) || pendingOffset < 0 || pendingOffset > pendingRefs.length) throw new Error("Invalid staged event offset");
      const chunk = pendingRefs.slice(pendingOffset, pendingOffset + PAGE_SIZE);
      const markets = await fetchEventMarkets(chunk);
      const { data: committed, error: commitError } = await supabase.rpc("polymarket_commit_staged_event_chunk", {
        p_owner: owner, p_offset: pendingOffset, p_markets: markets, p_count: chunk.length,
      });
      if (commitError || !committed) throw new Error(`Failed to commit staged event chunk: ${commitError?.message ?? "lease expired"}`);
      pendingOffset += chunk.length;
      if (pendingOffset < pendingRefs.length) continue;
      eventPages++;
      eventsSynced += pendingEvents.length;
      eventCursor = pendingNextCursor;
      pendingRefs = null;
      pendingEvents = [];
      pendingOffset = 0;
      if (!eventCursor) break;
    }
    if (pendingRefs) partial = true;

    return new Response(JSON.stringify({ success: true, partial, synced, pages, reconciled, eventsSynced, eventPages, eventsReconciled, priorityEvents, cycleComplete: pages > 0 && !cursor, eventCycleComplete: eventPages > 0 && !eventCursor, startedAt }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sync-polymarket-catalog]", message);
    if (acquired) await supabase.from("polymarket_catalog_sync_state").update({ last_error: message, updated_at: new Date().toISOString() }).eq("source", "polymarket").eq("lease_owner", owner);
    return new Response(JSON.stringify({ success: false, error: "Catalog sync failed", synced, pages, reconciled, eventsSynced, eventPages, eventsReconciled }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    if (acquired) await supabase.from("polymarket_catalog_sync_state").update({ lease_owner: null, lease_expires_at: null }).eq("source", "polymarket").eq("lease_owner", owner);
  }
});
