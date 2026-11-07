import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("loads active topics for the selected category and filters invalid entries", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify([
    { label: "NFL", slug: "nfl" }, { label: "NFL duplicate", slug: "nfl" },
    { label: "Hidden", slug: "hidden", forceHide: true }, { label: "Invalid", slug: "../bad" },
  ])));
  vi.stubGlobal("fetch", fetchMock);
  const { getPolymarketTags } = await import("@/services/PolymarketTags.server");
  expect(await getPolymarketTags("sports")).toEqual([{ label: "NFL", value: "nfl" }]);
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(url.searchParams.get("tag")).toBe("sports");
  expect(await getPolymarketTags("sports")).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("uses Gamma related tags if the site's list is unavailable", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify([{ label: "Trump", slug: "trump" }])));
  vi.stubGlobal("fetch", fetchMock);
  const { getPolymarketTags } = await import("@/services/PolymarketTags.server");
  expect(await getPolymarketTags("politics")).toEqual([{ label: "Trump", value: "trump" }]);
  expect(String(fetchMock.mock.calls[1][0])).toContain("gamma-api.polymarket.com/tags/slug/politics/related-tags/tags");
});
