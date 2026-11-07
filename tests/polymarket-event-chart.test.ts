import { afterEach, describe, expect, it, vi } from "vitest";
import type { PolymarketMarket } from "@/types/polymarket";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("event chart requests", () => {
  it.each([["1h", "60"], ["1d", "300"], ["1w", "1800"], ["1m", null], ["max", null]] as const)("requests the Polymarket interval %s", async (interval, bucket) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ timestamp: 100, price: 0.1 }, { timestamp: 200, price: 0.2 }] })));
    vi.stubGlobal("fetch", fetchMock);
    const { getEventChartSeries } = await import("@/services/PolymarketEventAnalytics.server");
    const market = { id: "1", question: "Event", outcomes: [{ label: "Yes", tokenId: "token-a", price: "0.3" }] } as PolymarketMarket;
    const result = await getEventChartSeries([market], interval);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe("https://data-api.polymarket.com");
    expect(url.searchParams.get("interval")).toBe(interval);
    expect(url.searchParams.get("bucket_seconds")).toBe(bucket);
    expect(result[0].points).toEqual([{ time: 100, price: 0.1 }, { time: 200, price: 0.2 }]);
  });
});
