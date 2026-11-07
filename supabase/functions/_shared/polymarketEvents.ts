// Server-only event synchronisation. Fetching is read-only; the caller commits
// rows and cursor together under the catalog lease.
const GAMMA = "https://gamma-api.polymarket.com";
const EVENT_PAGE_SIZE = 10;

const textValue = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};
const numberValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const dateValue = (value: unknown): string | null => {
  const text = textValue(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
};

export type GammaEventRecord = Record<string, unknown> & { markets?: unknown; tags?: unknown };

export function mapPolymarketEvent(input: GammaEventRecord, syncedAt: string) {
  const id = textValue(input.id);
  const title = textValue(input.title);
  if (!id || !title) return null;
  const questions = Array.isArray(input.markets) ? input.markets.flatMap((market) => {
    if (!market || typeof market !== "object" || Array.isArray(market)) return [];
    const question = textValue((market as Record<string, unknown>).question);
    return question ? [question] : [];
  }) : [];
  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.flatMap((tag) => {
      if (!tag || typeof tag !== "object") return [];
      const slug = textValue((tag as Record<string, unknown>).slug);
      return slug ? [slug] : [];
    }))] : [];
  return {
    source: "polymarket", event_id: id, title, search_text: [title, ...questions].join("\n"), slug: textValue(input.slug),
    description: textValue(input.description), image_url: textValue(input.image) ?? textValue(input.icon),
    volume_usd: numberValue(input.volume), volume_24h_usd: numberValue(input.volume24hr),
    liquidity_usd: numberValue(input.liquidity), end_date: dateValue(input.endDate),
    source_updated_at: dateValue(input.updatedAt), event_status: input.closed === true ? "closed" : "open",
    // The normalized columns above contain everything the catalog reads.
    // Avoid retaining a second copy of the full upstream response.
    tags, source_payload: {}, synced_at: syncedAt,
  };
}

function mapEventRecords(records: unknown[], mapMarket: (input: any) => Record<string, unknown> | null) {
  const syncedAt = new Date().toISOString();
  const events = new Map<string, ReturnType<typeof mapPolymarketEvent> & {}>();
  const markets = new Map<string, Record<string, unknown>>();
  for (const value of records) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Gamma returned an invalid event");
    const record = value as GammaEventRecord;
    const event = mapPolymarketEvent(record, syncedAt);
    if (!event || !Array.isArray(record.markets)) throw new Error("Gamma returned an incomplete event");
    events.set(event.event_id, event);
    for (const raw of record.markets) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const market = mapMarket(raw);
      if (market && typeof market.market_id === "string") markets.set(market.market_id, { ...market, event_id: event.event_id });
    }
  }
  return { events: [...events.values()], markets: [...markets.values()] };
}

export async function syncEventPage(
  cursor: string | null,
  mapMarket: (input: any) => Record<string, unknown> | null,
  timeoutMs = 15_000,
) {
  const url = new URL("/events/keyset", GAMMA);
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(EVENT_PAGE_SIZE));
  if (cursor) url.searchParams.set("after_cursor", cursor);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Gamma event request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { events?: unknown }).events)) throw new Error("Gamma returned an invalid event page");
  const result = mapEventRecords((payload as { events: unknown[] }).events, mapMarket);
  const nextCursor = textValue((payload as { next_cursor?: unknown }).next_cursor);
  if (nextCursor && nextCursor === cursor) throw new Error("Gamma repeated event cursor");
  return { nextCursor, ...result };
}

export async function fetchPriorityEvents(mapMarket: (input: any) => Record<string, unknown> | null, timeoutMs = 15_000) {
  const url = new URL("/events", GAMMA);
  url.searchParams.set("closed", "false");
  url.searchParams.set("active", "true");
  url.searchParams.set("limit", String(EVENT_PAGE_SIZE));
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Gamma priority events request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Gamma returned an invalid priority event page");
  return mapEventRecords(payload, mapMarket);
}
