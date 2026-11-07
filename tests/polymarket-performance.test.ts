import { afterEach, expect, it, vi } from "vitest";
import { polymarketThumbnail } from "@/components/polymarket/PolymarketImage";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("uses a small thumbnail only for Polymarket's public image bucket", () => {
  const original = "https://polymarket-upload.s3.us-east-2.amazonaws.com/nfl.png";
  const url = new URL(polymarketThumbnail(original));
  expect(url.origin).toBe("https://polymarket.com");
  expect(url.searchParams.get("url")).toBe(original);
  expect(url.searchParams.get("w")).toBe("96");
  expect(polymarketThumbnail("https://example.com/a.png")).toBe("https://example.com/a.png");
});

it("deduplicates concurrent public insights and retries failures", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { taker_volume_total: 12 } })));
  vi.stubGlobal("fetch", fetchMock);
  const { getEventLiveVolume } = await import("@/services/PolymarketInsights.server");
  expect(await Promise.all([getEventLiveVolume("123"), getEventLiveVolume("123")])).toEqual([12, 12]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockImplementationOnce(async () => new Response("error", { status: 500 }));
  await expect(getEventLiveVolume("456")).rejects.toThrow();
  await expect(getEventLiveVolume("456")).resolves.toBe(12);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
