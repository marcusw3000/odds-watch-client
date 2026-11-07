import type {
  PolymarketMarket,
  PolymarketMarketsPage,
  PolymarketOutcome,
  PolymarketProtocolVersion,
} from "@/types/polymarket";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/config";
import type { Database, Json } from "@/integrations/supabase/types";

const GAMMA_API_URL = "https://gamma-api.polymarket.com";
const CACHE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_PAGE_SIZE = 30;

interface CacheEntry { expiresAt: number; value: PolymarketMarketsPage; }
interface GammaMarketRecord {
  id?: unknown; slug?: unknown; question?: unknown; description?: unknown; image?: unknown;
  icon?: unknown; conditionId?: unknown; version?: unknown; outcomes?: unknown; outcomePrices?: unknown;
  clobTokenIds?: unknown; positionIds?: unknown; volume?: unknown; volumeNum?: unknown;
  liquidity?: unknown; liquidityNum?: unknown; spread?: unknown; endDate?: unknown; updatedAt?: unknown;
  acceptingOrders?: unknown; restricted?: unknown;
  category?: unknown; closed?: unknown; events?: unknown;
}

const pageCache = new Map<string, CacheEntry>();
const marketCache = new Map<string, { expiresAt: number; value: PolymarketMarket | null }>();
const persistentCache = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

function protocolVersion(value: unknown): PolymarketProtocolVersion {
  return value === "v1" || value === "v2" ? value : "unknown";
}

function mapOutcomes(record: GammaMarketRecord): PolymarketOutcome[] {
  const labels = parseStringArray(record.outcomes);
  const prices = parseStringArray(record.outcomePrices);
  const tokenIds = parseStringArray(record.clobTokenIds);
  const positionIds = Array.isArray(record.positionIds)
    ? record.positionIds.filter((item): item is string => typeof item === "string") : [];
  return labels.map((label, index) => ({
    label, price: prices[index] ?? null, tokenId: tokenIds[index] ?? null, positionId: positionIds[index] ?? null,
  }));
}

function mapMarket(record: GammaMarketRecord): PolymarketMarket | null {
  const id = asString(record.id);
  const question = asString(record.question);
  if (!id || !question) return null;
  const slug = asString(record.slug);
  return {
    source: "polymarket", id, slug, question, eventId: Array.isArray(record.events) && record.events[0] && typeof record.events[0] === "object" ? asString(record.events[0].id) : null, description: asString(record.description),
    imageUrl: asString(record.image) ?? asString(record.icon), conditionId: asString(record.conditionId),
    version: protocolVersion(record.version), outcomes: mapOutcomes(record),
    volumeUsd: asString(record.volume) ?? asString(record.volumeNum),
    liquidityUsd: asString(record.liquidity) ?? asString(record.liquidityNum), spread: asString(record.spread),
    endDate: asString(record.endDate), sourceUpdatedAt: asString(record.updatedAt),
    acceptingOrders: record.acceptingOrders === true, restricted: record.restricted === true,
    category: asString(record.category), status: record.closed === true ? "closed" : "open",
    url: slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : null,
  };
}

type CachedMarket = Database["public"]["Tables"]["polymarket_market_cache"]["Row"];

function cachedOutcomes(value: Json): PolymarketOutcome[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const label = asString(record.label);
    if (!label) return [];
    return [{ label, price: asString(record.price), tokenId: asString(record.tokenId), positionId: asString(record.positionId) }];
  });
}

function mapCachedMarket(record: CachedMarket): PolymarketMarket {
  const slug = record.slug;
  return {
    source: "polymarket", id: record.market_id, eventId: (record as any).event_id ?? null, slug, question: record.question,
    description: record.description, imageUrl: record.image_url, conditionId: record.condition_id,
    version: protocolVersion(record.protocol_version), outcomes: cachedOutcomes(record.outcomes),
    volumeUsd: record.volume_usd === null ? null : String(record.volume_usd),
    liquidityUsd: record.liquidity_usd === null ? null : String(record.liquidity_usd),
    spread: record.spread === null ? null : String(record.spread), endDate: record.end_date,
    sourceUpdatedAt: record.source_updated_at, acceptingOrders: record.accepting_orders,
    restricted: record.restricted, category: (record as any).category ?? null, status: (record as any).market_status === "closed" ? "closed" : "open", url: slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : null,
  };
}

async function cachedMarkets(limit: number, query?: string): Promise<PolymarketMarketsPage | null> {
  const { data, error } = await persistentCache.from("polymarket_market_cache")
    .select("*").eq("source", "polymarket").order("synced_at", { ascending: false }).limit(limit);
  if (error || !data?.length) return null;
  const normalizedQuery = query?.toLocaleLowerCase("pt-BR");
  const markets = data.map(mapCachedMarket).filter((market) =>
    !normalizedQuery || `${market.question} ${market.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
  );
  return {
    source: "polymarket", markets, nextCursor: null, fetchedAt: data[0].synced_at,
    searchQuery: query ?? null, totalMatches: null, stale: true,
  };
}

async function cachedMarket(id: string): Promise<PolymarketMarket | null> {
  const { data, error } = await persistentCache.from("polymarket_market_cache")
    .select("*").eq("source", "polymarket").eq("market_id", id).maybeSingle();
  return error || !data ? null : mapCachedMarket(data);
}

export async function listPolymarketMarkets({ cursor = null, limit = 18 }: {
  cursor?: string | null; limit?: number;
} = {}): Promise<PolymarketMarketsPage> {
  const pageSize = Math.min(Math.max(Math.floor(limit), 1), MAX_PAGE_SIZE);
  const key = `${cursor ?? "first"}:${pageSize}`;
  const cached = pageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: PolymarketMarketsPage;
  try {
    const url = new URL("/markets/keyset", GAMMA_API_URL);
    url.searchParams.set("closed", "false");
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("order", "volume24hr");
    url.searchParams.set("ascending", "false");
    if (cursor) url.searchParams.set("after_cursor", cursor);
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Polymarket market data request failed (${response.status})`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { markets?: unknown }).markets)) throw new Error("Polymarket returned an invalid markets response");
    value = { markets: (payload as { markets: unknown[] }).markets.map((record) => mapMarket(record as GammaMarketRecord)).filter((market): market is PolymarketMarket => market !== null), nextCursor: asString((payload as { next_cursor?: unknown }).next_cursor), fetchedAt: new Date().toISOString(), source: "polymarket", searchQuery: null, totalMatches: null };
  } catch (error) {
    const fallback = cursor ? null : await cachedMarkets(pageSize);
    if (!fallback) throw error;
    value = fallback;
  }
  pageCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function listPolymarketCategory(category: string): Promise<PolymarketMarketsPage> {
  const allowed = new Set(["brazil", "politics", "sports", "crypto", "esports", "finance", "geopolitics", "tech", "elections", "culture", "economy"]);
  if (!allowed.has(category)) throw new Error("Invalid Polymarket category");
  const key = `category:${category}`;
  const cached = pageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL("/events", GAMMA_API_URL);
  url.searchParams.set("closed", "false");
  url.searchParams.set("active", "true");
  url.searchParams.set("limit", "20");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");
  url.searchParams.set("tag_slug", category);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Polymarket category request failed (${response.status})`);
  const events: unknown = await response.json();
  if (!Array.isArray(events)) throw new Error("Polymarket returned an invalid category response");
  const seen = new Set<string>();
  const markets: PolymarketMarket[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object" || !Array.isArray(event.markets)) continue;
    let addedFromEvent = 0;
    for (const record of event.markets) {
      const market = mapMarket(record as GammaMarketRecord);
      if (market && market.status !== "closed" && !seen.has(market.id)) {
        seen.add(market.id);
        markets.push({ ...market, category, eventId: asString(event.id) });
        addedFromEvent++;
        if (markets.length >= MAX_PAGE_SIZE || addedFromEvent >= 3) break;
      }
    }
    if (markets.length >= MAX_PAGE_SIZE) break;
  }
  const value: PolymarketMarketsPage = { markets, nextCursor: null, fetchedAt: new Date().toISOString(), source: "polymarket", searchQuery: null, totalMatches: null };
  pageCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function searchPolymarketMarkets(query: string): Promise<PolymarketMarketsPage> {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 2 || normalizedQuery.length > 80) {
    throw new Error("Polymarket search query must contain 2 to 80 characters");
  }
  const key = `search:${normalizedQuery.toLowerCase()}`;
  const cached = pageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: PolymarketMarketsPage;
  try {
    const url = new URL("/public-search", GAMMA_API_URL);
    url.searchParams.set("q", normalizedQuery);
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Polymarket search request failed (${response.status})`);
    const payload: unknown = await response.json();
    const events = payload && typeof payload === "object" && Array.isArray((payload as { events?: unknown }).events)
      ? (payload as { events: unknown[] }).events : null;
    if (!events) throw new Error("Polymarket returned an invalid search response");
    const seen = new Set<string>();
    const markets: PolymarketMarket[] = [];
    for (const event of events) {
      const eventMarkets = event && typeof event === "object" && Array.isArray((event as { markets?: unknown }).markets)
        ? (event as { markets: unknown[] }).markets : [];
      for (const record of eventMarkets) {
        const market = mapMarket(record as GammaMarketRecord);
        if (market && !seen.has(market.id)) {
          seen.add(market.id);
          markets.push({ ...market, eventId: asString((event as { id?: unknown }).id) });
        }
      }
    }
    const totalMatches = payload && typeof payload === "object" && typeof (payload as { pagination?: { totalResults?: unknown } }).pagination?.totalResults === "number"
      ? (payload as { pagination: { totalResults: number } }).pagination.totalResults : null;
    value = { markets, nextCursor: null, fetchedAt: new Date().toISOString(), source: "polymarket", searchQuery: normalizedQuery, totalMatches };
  } catch (error) {
    const fallback = await cachedMarkets(MAX_PAGE_SIZE, normalizedQuery);
    if (!fallback) throw error;
    value = fallback;
  }
  pageCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function getPolymarketMarket(id: string): Promise<PolymarketMarket | null> {
  if (!/^\d{1,20}$/.test(id)) return null;
  const cached = marketCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let market: PolymarketMarket | null;
  try {
    const url = new URL("/markets/keyset", GAMMA_API_URL);
    url.searchParams.set("id", id);
    url.searchParams.set("closed", "any");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Polymarket market data request failed (${response.status})`);
    const payload: unknown = await response.json();
    const records = payload && typeof payload === "object" && Array.isArray((payload as { markets?: unknown }).markets)
      ? (payload as { markets: unknown[] }).markets : null;
    if (!records) throw new Error("Polymarket returned an invalid market response");
    market = records.map((record) => mapMarket(record as GammaMarketRecord)).find((item) => item?.id === id) ?? null;
  } catch (error) {
    const fallback = await cachedMarket(id);
    if (!fallback) throw error;
    market = fallback;
  }
  marketCache.set(id, { value: market, expiresAt: Date.now() + CACHE_TTL_MS });
  return market;
}
