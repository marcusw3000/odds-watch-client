import type { PolymarketMarket } from "@/types/polymarket";

export interface EventPriceSeries { marketId: string; label: string; points: { time: number; price: number }[]; }
const seriesCache = new Map<string, { expires: number; value: EventPriceSeries[] }>();
export const EVENT_CHART_INTERVALS = ["1h", "1d", "1w", "1m", "max"] as const;
export type EventChartInterval = typeof EVENT_CHART_INTERVALS[number];
const eventChartCache = new Map<string, { expires: number; value: EventPriceSeries[] }>();

/** Uses the same public endpoint and interval parameters observed on Polymarket's event page. */
export async function getEventChartSeries(markets: PolymarketMarket[], interval: EventChartInterval): Promise<EventPriceSeries[]> {
  const candidates = markets.flatMap((market) => (markets.length === 1 ? market.outcomes : market.outcomes.slice(0, 1))
    .filter((outcome) => outcome.tokenId)
    .map((outcome) => ({ market, outcome })))
    .sort((a, b) => Number(b.outcome.price ?? 0) - Number(a.outcome.price ?? 0)).slice(0, 4);
  if (!candidates.length) return [];
  const key = `${interval}:${candidates.map(({ outcome }) => outcome.tokenId).join(",")}`;
  const cached = eventChartCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const buckets: Partial<Record<EventChartInterval, number>> = { "1h": 60, "1d": 300, "1w": 1800 };
  const results = await Promise.allSettled(candidates.map(async ({ market, outcome }): Promise<EventPriceSeries | null> => {
    const url = new URL("https://data-api.polymarket.com/v2/prices-history");
    url.searchParams.set("token_id", outcome.tokenId!);
    url.searchParams.set("interval", interval);
    if (buckets[interval]) url.searchParams.set("bucket_seconds", String(buckets[interval]));
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Price history unavailable (${response.status})`);
    const payload: unknown = await response.json();
    const records = payload && typeof payload === "object" && "data" in payload && Array.isArray(payload.data) ? payload.data : [];
    const points = records.flatMap((record: unknown) => {
      if (!record || typeof record !== "object") return [];
      const item = record as { timestamp?: unknown; price?: unknown };
      if (item.timestamp == null || item.price == null) return [];
      const time = Number(item.timestamp), price = Number(item.price);
      return Number.isFinite(time) && time > 0 && Number.isFinite(price) && price >= 0 && price <= 1 ? [{ time, price }] : [];
    }).sort((a, b) => a.time - b.time);
    return points.length >= 2 ? { marketId: `${market.id}-${outcome.tokenId}`, label: markets.length === 1 ? outcome.label : market.question, points } : null;
  }));
  const value = results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
  if (results.every((result) => result.status === "fulfilled")) eventChartCache.set(key, { value, expires: Date.now() + 60_000 });
  return value;
}
export async function getEventPriceSeries(markets: PolymarketMarket[], hours = 24): Promise<EventPriceSeries[]> {
  const candidates = markets.flatMap((market) => (markets.length === 1 ? market.outcomes : market.outcomes.slice(0, 1))
    .filter((outcome) => outcome.tokenId)
    .map((outcome) => ({ market, outcome })))
    .sort((a, b) => Number(b.outcome.price ?? 0) - Number(a.outcome.price ?? 0)).slice(0, 4);
  const tokens = candidates.map(({ outcome }) => outcome.tokenId!);
  if (!tokens.length) return [];
  const boundedHours = Math.max(1, Math.min(24 * 30, hours));
  const key = `${boundedHours}:${tokens.join(",")}`;
  const cached = seriesCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const end = Math.floor(Date.now() / 1000);
  const start = end - boundedHours * 3600;
  const intervals: { start: number; end: number }[] = [];
  for (let from = start; from < end; from += 7 * 86400) intervals.push({ start: from, end: Math.min(end, from + 7 * 86400) });
  const histories = await Promise.all(intervals.map(async (interval) => {
    const response = await fetch("https://clob.polymarket.com/batch-prices-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markets: tokens, start_ts: interval.start, end_ts: interval.end, fidelity: boundedHours > 24 ? 360 : 60 }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Price history unavailable (${response.status})`);
    const data: unknown = await response.json();
    return data && typeof data === "object" && "history" in data && typeof data.history === "object" && data.history ? data.history as Record<string, unknown> : {};
  }));
  const value = candidates.flatMap(({ market, outcome }) => {
    const series = histories.flatMap((history) => Array.isArray(history[outcome.tokenId!]) ? history[outcome.tokenId!] as unknown[] : []);
    const points = series.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const point = item as { t?: unknown; p?: unknown };
      if (point.t == null || point.p == null) return [];
      const time = Number(point.t), price = Number(point.p);
      return Number.isFinite(time) && time > 0 && Number.isFinite(price) && price >= 0 && price <= 1 ? [{ time, price }] : [];
    }).sort((a, b) => a.time - b.time);
    return points.length >= 2 ? [{ marketId: `${market.id}-${outcome.tokenId}`, label: markets.length === 1 ? outcome.label : market.question, points }] : [];
  });
  seriesCache.set(key, { value, expires: Date.now() + 60_000 });
  return value;
}
