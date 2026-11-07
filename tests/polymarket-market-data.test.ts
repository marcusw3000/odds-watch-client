import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Polymarket market-data provider", () => {
  it("normalizes Gamma data while preserving external IDs as strings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      markets: [{
        id: "12345678901234567890",
        question: "Will this test pass?",
        slug: "test-market",
        version: "v2",
        outcomes: '["Yes","No"]',
        outcomePrices: '["0.52","0.48"]',
        clobTokenIds: '["10000000000000000001","10000000000000000002"]',
        positionIds: ["20000000000000000001", "20000000000000000002"],
        volumeNum: 123.45,
        acceptingOrders: true,
      }],
      next_cursor: "next-page",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { listPolymarketMarkets } = await import("@/services/PolymarketMarketDataProvider.server");
    const page = await listPolymarketMarkets({ limit: 999 });

    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("limit")).toBe("30");
    expect(page.nextCursor).toBe("next-page");
    expect(page.markets[0]).toMatchObject({
      id: "12345678901234567890",
      version: "v2",
      volumeUsd: "123.45",
      acceptingOrders: true,
    });
    expect(page.markets[0]?.outcomes[0]).toEqual({
      label: "Yes",
      price: "0.52",
      tokenId: "10000000000000000001",
      positionId: "20000000000000000001",
    });
  });

  it("rejects an invalid search before calling the external API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { searchPolymarketMarkets } = await import("@/services/PolymarketMarketDataProvider.server");

    await expect(searchPolymarketMarkets("x")).rejects.toThrow("2 to 80 characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the persisted catalog when Gamma is unavailable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("gamma-api.polymarket.com")) return new Response("unavailable", { status: 503 });
      if (url.includes("polymarket_market_cache")) {
        return new Response(JSON.stringify([{
          source: "polymarket", market_id: "42", slug: "cached-market", question: "Cached question",
          description: null, image_url: null, condition_id: null, protocol_version: "v2",
          outcomes: [{ label: "Yes", price: "0.7", tokenId: "token", positionId: "position" }],
          volume_usd: 12.3, liquidity_usd: 4.5, spread: 0.01, end_date: null,
          source_updated_at: null, accepting_orders: false, restricted: false, synced_at: "2026-11-03T00:00:00.000Z",
        }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { listPolymarketMarkets } = await import("@/services/PolymarketMarketDataProvider.server");

    const page = await listPolymarketMarkets();

    expect(page).toMatchObject({ stale: true, fetchedAt: "2026-11-03T00:00:00.000Z" });
    expect(page.markets[0]).toMatchObject({ id: "42", question: "Cached question", volumeUsd: "12.3" });
  });
});
