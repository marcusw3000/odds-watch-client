export interface PolymarketLiveQuote {
  assetId: string;
  bestBid: string | null;
  bestAsk: string | null;
  lastTradePrice: string | null;
  receivedAt: number;
}

function decimal(value: unknown): string | null {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? String(value) : null;
}

/** Extract only quotes for the subscribed token; never infer the opposite outcome. */
export function parseMarketStreamMessage(raw: string, assetId: string): Partial<PolymarketLiveQuote> | null {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  const messages = Array.isArray(data) ? data : [data];
  let update: Partial<PolymarketLiveQuote> | null = null;
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const event = message as Record<string, unknown>;
    const type = event.event_type ?? event.type;
    const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : event;
    const changes = type === "price_change" && Array.isArray(payload.price_changes) ? payload.price_changes : [payload];
    for (const item of changes) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      if ((value.asset_id ?? value.assetId) !== assetId) continue;
      const next: Partial<PolymarketLiveQuote> = {};
      const bid = decimal(value.best_bid ?? value.bestBid);
      const ask = decimal(value.best_ask ?? value.bestAsk);
      if (bid !== null) next.bestBid = bid;
      if (ask !== null) next.bestAsk = ask;
      if (type === "last_trade_price") {
        const last = decimal(value.price);
        if (last !== null) next.lastTradePrice = last;
      }
      if (type === "book") {
        const levels = (items: unknown, side: "bid" | "ask") => {
          if (!Array.isArray(items)) return null;
          const prices = items.flatMap((level) => {
            if (!level || typeof level !== "object") return [];
            const p = decimal((level as Record<string, unknown>).price);
            const size = Number((level as Record<string, unknown>).size);
            return p !== null && Number.isFinite(size) && size > 0 ? [Number(p)] : [];
          });
          return prices.length ? String(side === "bid" ? Math.max(...prices) : Math.min(...prices)) : null;
        };
        next.bestBid = levels(value.bids ?? value.buys, "bid");
        next.bestAsk = levels(value.asks ?? value.sells, "ask");
      }
      if (Object.keys(next).length) update = { ...update, ...next };
    }
  }
  return update;
}
