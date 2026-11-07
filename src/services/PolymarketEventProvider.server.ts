import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/config";
import type { PolymarketMarket, PolymarketOutcome, PolymarketProtocolVersion } from "@/types/polymarket";

export interface PolymarketEvent {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  volumeUsd: string | null;
  endDate: string | null;
  tags: string[];
  markets: PolymarketMarket[];
  stale: boolean;
}

const cache = new Map<string, { value: PolymarketEvent; expiresAt: number }>();
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const asText = (v: unknown): string | null => typeof v === "string" && v.trim() ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
function stringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v !== "string") return [];
  try { return stringArray(JSON.parse(v)); } catch { return []; }
}
function fromGammaMarket(value: unknown): PolymarketMarket | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const id = asText(r.id), question = asText(r.question);
  if (!id || !question) return null;
  const labels = stringArray(r.outcomes), prices = stringArray(r.outcomePrices), tokenIds = stringArray(r.clobTokenIds), positionIds = stringArray(r.positionIds);
  const outcomes: PolymarketOutcome[] = labels.map((label, i) => ({ label, price: prices[i] ?? null, tokenId: tokenIds[i] ?? null, positionId: positionIds[i] ?? null }));
  const slug = asText(r.slug);
  const version: PolymarketProtocolVersion = r.version === "v1" || r.version === "v2" ? r.version : "unknown";
  return { source: "polymarket", id, question, slug, description: asText(r.description), imageUrl: asText(r.image) ?? asText(r.icon), conditionId: asText(r.conditionId), version, outcomes, volumeUsd: asText(r.volume) ?? asText(r.volumeNum), liquidityUsd: asText(r.liquidity) ?? asText(r.liquidityNum), spread: asText(r.spread), endDate: asText(r.endDate), sourceUpdatedAt: asText(r.updatedAt), acceptingOrders: r.acceptingOrders === true, restricted: r.restricted === true, category: asText(r.category), status: r.closed === true ? "closed" : "open", url: slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : null };
}
function fromCachedMarket(r: Record<string, unknown>): PolymarketMarket | null {
  const id = asText(r.market_id), question = asText(r.question);
  if (!id || !question) return null;
  const outcomes = Array.isArray(r.outcomes) ? r.outcomes.flatMap((item): PolymarketOutcome[] => {
    if (!item || typeof item !== "object") return [];
    const x = item as Record<string, unknown>, label = asText(x.label);
    return label ? [{ label, price: asText(x.price), tokenId: asText(x.tokenId), positionId: asText(x.positionId) }] : [];
  }) : [];
  const slug = asText(r.slug);
  const version: PolymarketProtocolVersion = r.protocol_version === "v1" || r.protocol_version === "v2" ? r.protocol_version : "unknown";
  return { source: "polymarket", id, question, slug, description: asText(r.description), imageUrl: asText(r.image_url), conditionId: asText(r.condition_id), version, outcomes, volumeUsd: asText(r.volume_usd), liquidityUsd: asText(r.liquidity_usd), spread: asText(r.spread), endDate: asText(r.end_date), sourceUpdatedAt: asText(r.source_updated_at), acceptingOrders: r.accepting_orders === true, restricted: r.restricted === true, category: asText(r.category), status: r.market_status === "closed" ? "closed" : "open", url: slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : null };
}
async function cachedEvent(id: string): Promise<PolymarketEvent | null> {
  // Types may predate the additive catalog migration.
  const client = db as any;
  const [eventResult, marketResult] = await Promise.all([
    client.from("polymarket_event_cache").select("*").eq("source", "polymarket").eq("event_id", id).maybeSingle(),
    client.from("polymarket_market_cache").select("*").eq("source", "polymarket").eq("event_id", id).order("volume_usd", { ascending: false, nullsFirst: false }),
  ]);
  if (eventResult.error || marketResult.error || !eventResult.data) return null;
  const e = eventResult.data as Record<string, unknown>;
  const title = asText(e.title);
  if (!title) return null;
  return { id, slug: asText(e.slug), title, description: asText(e.description), imageUrl: asText(e.image_url), volumeUsd: asText(e.volume_usd), endDate: asText(e.end_date), tags: stringArray(e.tags), markets: (marketResult.data as Record<string, unknown>[]).map(fromCachedMarket).filter((m): m is PolymarketMarket => m !== null), stale: true };
}

export async function getPolymarketEvent(id: string): Promise<PolymarketEvent | null> {
  if (!/^\d{1,20}$/.test(id)) return null;
  const stored = cache.get(id);
  if (stored && stored.expiresAt > Date.now()) return stored.value;
  try {
    const response = await fetch(`https://gamma-api.polymarket.com/events/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Gamma event request failed (${response.status})`);
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid event response");
    const e = raw as Record<string, unknown>, title = asText(e.title);
    if (!title || asText(e.id) !== id || !Array.isArray(e.markets)) throw new Error("Incomplete event response");
    const tags = Array.isArray(e.tags) ? e.tags.flatMap((tag) => tag && typeof tag === "object" && asText((tag as Record<string, unknown>).slug) ? [asText((tag as Record<string, unknown>).slug)!] : []) : [];
    const event: PolymarketEvent = { id, slug: asText(e.slug), title, description: asText(e.description), imageUrl: asText(e.image) ?? asText(e.icon), volumeUsd: asText(e.volume), endDate: asText(e.endDate), tags, markets: e.markets.map(fromGammaMarket).filter((m): m is PolymarketMarket => m !== null), stale: false };
    cache.set(id, { value: event, expiresAt: Date.now() + 30_000 });
    return event;
  } catch (error) {
    const fallback = await cachedEvent(id);
    if (fallback) return fallback;
    throw error;
  }
}
