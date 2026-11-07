import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("Polymarket catalog filters", () => {
  it("defaults to Brazil while preserving trending and global search", async () => {
    const { parseCatalogFilters } = await import("@/services/PolymarketCatalogCache.server");
    expect(parseCatalogFilters(new URLSearchParams()).category).toBe("brazil");
    expect(parseCatalogFilters(new URLSearchParams("category=")).category).toBe("");
    expect(parseCatalogFilters(new URLSearchParams("q=bitcoin")).category).toBe("");
    expect(parseCatalogFilters(new URLSearchParams("q=bitcoin&category=brazil")).category).toBe("brazil");
  });

  it("combines a Brazil subcategory with the country filter", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("polymarket_catalog_sync_public")) return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "*/0" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { browsePolymarketCache, parseCatalogFilters } = await import("@/services/PolymarketCatalogCache.server");
    const filters = parseCatalogFilters(new URLSearchParams("category=brazil&subcategory=politics&page=2"));
    await browsePolymarketCache(filters);
    const request = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes("polymarket_event_cache"));
    expect(new URL(request!).searchParams.get("tags")).toContain("{brazil,politics}");
    expect(parseCatalogFilters(new URLSearchParams("category=sports&subcategory=politics")).subcategory).toBe("");
    expect(parseCatalogFilters(new URLSearchParams("category=brazil&subcategory=invalid%2Ftag")).subcategory).toBe("");
  });

  it("normalizes invalid input and preserves safe filters", async () => {
    const { parseCatalogFilters } = await import("@/services/PolymarketCatalogCache.server");
    expect(parseCatalogFilters(new URLSearchParams("category=invalid%2Fcategory&status=oops&sort=oops&page=-2&endAfter=2026-02-31&minVolume=-1"))).toMatchObject({ category: "", status: "open", sort: "volume", page: 1, endAfter: "", minVolume: "" });
    expect(parseCatalogFilters(new URLSearchParams("category=nba"))).toMatchObject({ category: "nba" });
    expect(parseCatalogFilters(new URLSearchParams("category=crypto&status=closed&sort=end_date&page=2&endBefore=2026-11-05&minVolume=100"))).toMatchObject({ category: "crypto", status: "closed", sort: "end_date", page: 2, endBefore: "2026-11-05", minVolume: "100" });
  });

  it("applies search, category, status, volume and date before paginating", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("polymarket_catalog_sync_public")) return new Response(JSON.stringify({ last_success_at: "2026-11-05T00:00:00Z", last_cycle_completed_at: "2026-11-05T00:00:00Z", event_last_cycle_completed_at: "2026-11-05T00:00:00Z" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("polymarket_event_cache")) return new Response(JSON.stringify([{ event_id: "12", title: "Bitcoin event", polymarket_market_cache: [{ market_id: "42", question: "Bitcoin event", event_id: "12", outcomes: [], market_status: "closed" }] }]), { status: 206, headers: { "Content-Type": "application/json", "Content-Range": "24-24/25" } });
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { browsePolymarketCache, parseCatalogFilters } = await import("@/services/PolymarketCatalogCache.server");
    const filters = parseCatalogFilters(new URLSearchParams("q=bitcoin&category=crypto&status=closed&sort=end_date&minVolume=100&endAfter=2026-11-01&endBefore=2026-11-30&page=2"));
    const page = await browsePolymarketCache(filters);
    const request = fetchMock.mock.calls.map((args) => String(args[0])).find((url) => url.includes("/polymarket_event_cache"));
    expect(request).toBeDefined();
    const params = new URL(request!).searchParams;
    expect(params.get("tags")).toContain("crypto");
    expect(params.get("event_status")).toBe("eq.closed");
    expect(params.get("search_text")).toBe("ilike.%bitcoin%");
    expect(params.get("volume_usd")).toBe("gte.100");
    expect(params.getAll("end_date")).toEqual(["gte.2026-11-01T00:00:00Z", "lt.2026-12-01T00:00:00.000Z"]);
    expect(params.get("offset")).toBe("24");
    expect(params.get("limit")).toBe("24");
    expect(params.get("polymarket_market_cache.order")).toBe("polymarket_preview_probability.desc.nullslast,volume_usd.desc.nullslast,market_id.asc");
    expect(params.get("polymarket_market_cache.limit")).toBe("2");
    expect(page).toMatchObject({ totalMatches: 25, hasNext: false, page: 2, cacheComplete: true, markets: [{ id: "42", eventId: "12" }] });
  });
});
