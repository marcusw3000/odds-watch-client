import { afterEach, expect, it, vi } from "vitest";
import type { PolymarketMarket } from "@/types/polymarket";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("loads a month in supported intervals and joins both outcome histories", async () => {
  const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
    const request = JSON.parse(String(options.body));
    expect(request.end_ts - request.start_ts).toBeLessThanOrEqual(7 * 86400);
    return new Response(JSON.stringify({ history: Object.fromEntries(request.markets.map((token: string) => [token, [{ t: request.start_ts, p: 0.25 }, { t: request.end_ts, p: 0.3 }]])) }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { getEventPriceSeries } = await import("@/services/PolymarketEventAnalytics.server");
  const market = { id: "1", question: "Event", outcomes: [{ label: "Yes", tokenId: "token-a", price: "0.3" }, { label: "No", tokenId: "token-b", price: "0.7" }] } as PolymarketMarket;
  const result = await getEventPriceSeries([market], 720);
  expect(fetchMock).toHaveBeenCalledTimes(5);
  expect(result.map((item) => item.label)).toEqual(["No", "Yes"]);
  expect(result.every((item) => item.points.length === 10)).toBe(true);
});
