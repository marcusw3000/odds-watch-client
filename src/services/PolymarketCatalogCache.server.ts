import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/config";
import type { PolymarketMarket, PolymarketMarketsPage, PolymarketOutcome } from "@/types/polymarket";

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
export const CATALOG_PAGE_SIZE = 24;
export const CATEGORY_SLUGS = ["politics", "sports", "crypto", "esports", "iran", "finance", "geopolitics", "tech", "elections", "pop-culture", "economy", "weather", "art"] as const;

export interface CatalogFilters {
  query: string;
  category: string;
  status: "open" | "closed" | "all";
  sort: "volume" | "end_date" | "updated";
  minVolume: string;
  endAfter: string;
  endBefore: string;
  page: number;
}

export interface CatalogPage extends PolymarketMarketsPage {
  events?: CatalogEvent[];
  page: number;
  hasNext: boolean;
  cacheComplete: boolean | null;
  lastSyncAt: string | null;
  cacheError?: boolean;
}

export interface CatalogEvent {
  id: string;
  title: string;
  imageUrl: string | null;
  volumeUsd: string | null;
  endDate: string | null;
  markets: PolymarketMarket[];
}

function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : "";
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const category = params.get("category") ?? "";
  const status = params.get("status");
  const sort = params.get("sort");
  const rawVolume = params.get("minVolume") ?? "";
  const amount = Number(rawVolume);
  const rawPage = Number(params.get("page") ?? 1);
  return {
    query: (params.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
    category: /^[a-z0-9-]{1,80}$/.test(category) ? category : "",
    status: status === "closed" || status === "all" ? status : "open",
    sort: sort === "end_date" || sort === "updated" ? sort : "volume",
    minVolume: rawVolume && Number.isFinite(amount) && amount >= 0 && amount <= 1e12 ? String(amount) : "",
    endAfter: validDate(params.get("endAfter")),
    endBefore: validDate(params.get("endBefore")),
    page: Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 10000 ? rawPage : 1,
  };
}

function mapRecord(row: Record<string, any>): PolymarketMarket {
  const outcomes: PolymarketOutcome[] = Array.isArray(row.outcomes) ? row.outcomes.flatMap((item: any) =>
    item && typeof item.label === "string" ? [{ label: item.label, price: typeof item.price === "string" || typeof item.price === "number" ? String(item.price) : null, tokenId: typeof item.tokenId === "string" ? item.tokenId : null, positionId: typeof item.positionId === "string" ? item.positionId : null }] : []) : [];
  return {
    source: "polymarket", id: String(row.market_id), slug: row.slug ?? null,
    question: row.question, description: row.description ?? null, imageUrl: row.image_url ?? null,
    conditionId: row.condition_id ?? null, version: row.protocol_version === "v1" || row.protocol_version === "v2" ? row.protocol_version : "unknown",
    outcomes, volumeUsd: row.volume_usd == null ? null : String(row.volume_usd), liquidityUsd: row.liquidity_usd == null ? null : String(row.liquidity_usd),
    spread: row.spread == null ? null : String(row.spread), endDate: row.end_date ?? null, sourceUpdatedAt: row.source_updated_at ?? null,
    acceptingOrders: row.accepting_orders === true, restricted: row.restricted === true,
    category: row.category ?? null, status: row.market_status === "closed" ? "closed" : "open",
    url: row.slug ? `https://polymarket.com/event/${encodeURIComponent(row.slug)}` : null,
    ...(row.event_id ? { eventId: String(row.event_id) } : {}),
  };
}

const catalogCache = new Map<string, { expires: number; promise: Promise<CatalogPage> }>();

/** Public results are shared briefly, including concurrent requests for the same filters. */
export async function browsePolymarketCache(filters: CatalogFilters): Promise<CatalogPage> {
  const key = JSON.stringify(filters);
  const cached = catalogCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = queryPolymarketCache(filters);
  const entry = { expires: Date.now() + 10_000, promise };
  if (catalogCache.size >= 100) catalogCache.delete(catalogCache.keys().next().value!);
  catalogCache.set(key, entry);
  try { return await promise; } catch (error) { if (catalogCache.get(key) === entry) catalogCache.delete(key); throw error; }
}

/** Filter and page events before retrieving a small preview of their markets. */
async function queryPolymarketCache(filters: CatalogFilters): Promise<CatalogPage> {
  const columns = "event_id,title,image_url,volume_usd,end_date,synced_at,polymarket_market_cache(market_id,event_id,slug,question,image_url,protocol_version,outcomes,volume_usd,market_status)";
  let query = db.from("polymarket_event_cache").select(columns, { count: "exact" }).eq("source", "polymarket");
  if (filters.category) query = query.contains("tags", [filters.category]);
  if (filters.status !== "all") query = query.eq("event_status", filters.status).eq("polymarket_market_cache.market_status", filters.status);
  // Escape LIKE metacharacters so searches for % and _ are treated as literals.
  if (filters.query) query = query.ilike("search_text", `%${filters.query.replace(/[\\%_]/g, "\\$&")}%`);
  if (filters.minVolume) query = query.gte("volume_usd", Number(filters.minVolume));
  if (filters.endAfter) query = query.gte("end_date", `${filters.endAfter}T00:00:00Z`);
  if (filters.endBefore) {
    const next = new Date(`${filters.endBefore}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    query = query.lt("end_date", next.toISOString());
  }
  const column = filters.sort === "end_date" ? "end_date" : filters.sort === "updated" ? "source_updated_at" : "volume_usd";
  query = query.order(column, { ascending: filters.sort === "end_date", nullsFirst: false }).order("event_id", { ascending: true });
  query = query.order("polymarket_preview_probability", { referencedTable: "polymarket_market_cache", ascending: false, nullsFirst: false })
    .order("volume_usd", { referencedTable: "polymarket_market_cache", ascending: false, nullsFirst: false })
    .order("market_id", { referencedTable: "polymarket_market_cache", ascending: true })
    .limit(2, { referencedTable: "polymarket_market_cache" });
  const start = (filters.page - 1) * CATALOG_PAGE_SIZE;
  const [result, status] = await Promise.all([
    query.range(start, start + CATALOG_PAGE_SIZE - 1),
    db.from("polymarket_catalog_sync_public").select("last_success_at,last_cycle_completed_at,event_last_cycle_completed_at").eq("source", "polymarket").maybeSingle(),
  ]);
  if (result.error) throw new Error(`Catálogo indisponível: ${result.error.message}`);
  const rows = (result.data ?? []) as unknown as Record<string, any>[];
  const events: CatalogEvent[] = rows.map((row) => ({
    id: String(row.event_id), title: row.title, imageUrl: row.image_url ?? null,
    volumeUsd: row.volume_usd == null ? null : String(row.volume_usd), endDate: row.end_date ?? null,
    markets: Array.isArray(row.polymarket_market_cache) ? row.polymarket_market_cache.map((market: Record<string, any>) => mapRecord(market)) : [],
  }));
  const count = result.count;
  return {
    source: "polymarket", markets: events.flatMap((event) => event.markets), events, nextCursor: null,
    fetchedAt: status.data?.last_success_at ?? rows[0]?.synced_at ?? new Date().toISOString(),
    searchQuery: filters.query || null, totalMatches: count, page: filters.page,
    hasNext: count === null ? rows.length === CATALOG_PAGE_SIZE : start + rows.length < count,
    cacheComplete: status.error ? null : Boolean(status.data?.last_cycle_completed_at && status.data?.event_last_cycle_completed_at),
    lastSyncAt: status.error ? null : status.data?.last_success_at ?? null,
  };
}
