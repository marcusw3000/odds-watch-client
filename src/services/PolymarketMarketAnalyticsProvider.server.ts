import type { PolymarketMarket, PolymarketMarketAnalytics, PolymarketOrderBookLevel, PolymarketPricePoint } from "@/types/polymarket";

const CLOB_API_URL = "https://clob.polymarket.com";
const DATA_API_URL = "https://data-api.polymarket.com";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;
const analyticsCache = new Map<string, { expiresAt: number; value: PolymarketMarketAnalytics | null }>();

function asDecimal(value: unknown): string | null {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? String(value) : null;
}

function parseLevels(value: unknown, side: "bid" | "ask"): PolymarketOrderBookLevel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { price?: unknown; size?: unknown };
    const price = asDecimal(record.price);
    const size = asDecimal(record.size);
    return price && size ? [{ price, size }] : [];
  }).sort((a, b) => side === "bid" ? Number(b.price) - Number(a.price) : Number(a.price) - Number(b.price)).slice(0, 8);
}

function parseHistory(value: unknown): PolymarketPricePoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { timestamp?: unknown; price?: unknown; resolution_seconds?: unknown; resolutionSeconds?: unknown };
    const seconds = typeof record.timestamp === "number" ? record.timestamp : Number(record.timestamp);
    const price = asDecimal(record.price);
    if (!Number.isFinite(seconds) || !price) return [];
    const milliseconds = seconds > 10_000_000_000 ? seconds : seconds * 1_000;
    const resolution = Number(record.resolution_seconds ?? record.resolutionSeconds);
    return [{ timestamp: new Date(milliseconds).toISOString(), price, resolutionSeconds: Number.isFinite(resolution) ? resolution : null }];
  });
}

export async function getPolymarketMarketAnalytics(market: PolymarketMarket, outcomeLabel?: string | null): Promise<PolymarketMarketAnalytics | null> {
  const outcome = market.outcomes.find((item) => item.label === outcomeLabel && (market.version === "v2" ? item.positionId : item.tokenId))
    ?? market.outcomes.find((item) => market.version === "v2" ? item.positionId : item.tokenId);
  const assetId = outcome ? (market.version === "v2" ? outcome.positionId : outcome.tokenId) : null;
  if (!outcome || !assetId) return null;
  const cached = analyticsCache.get(assetId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const bookUrl = new URL("/book", CLOB_API_URL);
  bookUrl.searchParams.set("token_id", assetId);
  const historyUrl = new URL("/v2/prices-history", DATA_API_URL);
  historyUrl.searchParams.set("token_id", assetId);
  historyUrl.searchParams.set("interval", "1d");
  historyUrl.searchParams.set("bucket_seconds", "3600");
  const [bookResult, historyResult] = await Promise.allSettled([
    fetch(bookUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
    fetch(historyUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
  ]);
  if (bookResult.status !== "fulfilled" && historyResult.status !== "fulfilled") return null;

  const bookPayload: unknown = bookResult.status === "fulfilled" && bookResult.value.ok ? await bookResult.value.json() : null;
  const historyPayload: unknown = historyResult.status === "fulfilled" && historyResult.value.ok ? await historyResult.value.json() : null;
  const book = bookPayload && typeof bookPayload === "object" ? bookPayload as { bids?: unknown; asks?: unknown; last_trade_price?: unknown; lastTradePrice?: unknown; tick_size?: unknown; tickSize?: unknown } : {};
  const history = historyPayload && typeof historyPayload === "object" && Array.isArray((historyPayload as { data?: unknown }).data)
    ? (historyPayload as { data: unknown[] }).data : [];
  const value: PolymarketMarketAnalytics = {
    outcomeLabel: outcome.label, assetId, fetchedAt: new Date().toISOString(), history: parseHistory(history),
    bids: parseLevels(book.bids, "bid"), asks: parseLevels(book.asks, "ask"),
    lastTradePrice: asDecimal(book.last_trade_price ?? book.lastTradePrice),
    tickSize: asDecimal(book.tick_size ?? book.tickSize),
  };
  analyticsCache.set(assetId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
