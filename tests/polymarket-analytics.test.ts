import { afterEach, describe, expect, it, vi } from "vitest";
import type { PolymarketMarket } from "@/types/polymarket";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const market: PolymarketMarket = {
  source: "polymarket", id: "1", slug: null, question: "Question", description: null, imageUrl: null,
  conditionId: "condition", version: "v2", volumeUsd: null, liquidityUsd: null, spread: null,
  endDate: null, sourceUpdatedAt: null, acceptingOrders: true, restricted: false, url: null,
  outcomes: [{ label: "Yes", price: "0.6", tokenId: null, positionId: "position-id" }],
};

describe("Polymarket analytics provider", () => {
  it("normalizes an order book and a 24-hour history snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("clob.polymarket.com")) return new Response(JSON.stringify({
        bids: [{ price: "0.5", size: "2" }, { price: "0.6", size: "1" }],
        asks: [{ price: "0.7", size: "3" }, { price: "0.65", size: "4" }],
        last_trade_price: "0.62", tick_size: "0.01",
      }), { status: 200 });
      return new Response(JSON.stringify({ data: [
        { timestamp: 1_700_000_000, price: 0.5, resolution_seconds: 3600 },
        { timestamp: 1_700_003_600, price: 0.6, resolution_seconds: 3600 },
      ] }), { status: 200 });
    }));
    const { getPolymarketMarketAnalytics } = await import("@/services/PolymarketMarketAnalyticsProvider.server");

    const analytics = await getPolymarketMarketAnalytics(market);

    expect(analytics).toMatchObject({ outcomeLabel: "Yes", assetId: "position-id", lastTradePrice: "0.62", tickSize: "0.01" });
    expect(analytics?.bids.map((level) => level.price)).toEqual(["0.6", "0.5"]);
    expect(analytics?.asks.map((level) => level.price)).toEqual(["0.65", "0.7"]);
    expect(analytics?.history).toHaveLength(2);
  });
});
