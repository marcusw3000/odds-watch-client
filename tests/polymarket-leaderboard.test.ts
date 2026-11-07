import { afterEach, describe, expect, it, vi } from "vitest";
import { getPolymarketLeaderboard } from "@/services/PolymarketLeaderboard.server";

afterEach(() => vi.unstubAllGlobals());

describe("Polymarket public leaderboard", () => {
  it("requests the v2 board with the selected filters and maps valid traders", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ rank: 1, user_id: "0x1234567890123456789012345678901234567890", user_name: "Trader", pnl: -42.5, volume: 100, profile_image: "https://example.com/a.png" }, { rank: 2, user_id: "invalid", pnl: 0, volume: 0 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const entries = await getPolymarketLeaderboard(new URLSearchParams("period=week&category=sports&order=VOLUME"));
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/v2/leaderboard");
    expect(Object.fromEntries(url.searchParams)).toEqual({ time_period: "week", category: "sports", sort_by: "VOLUME", limit: "50" });
    expect(entries).toEqual({ entries: [{ rank: 1, address: "0x1234567890123456789012345678901234567890", name: "Trader", image: "https://example.com/a.png", pnl: -42.5, volume: 100 }], nextCursor: null });
  });

  it("rejects invalid filters and upstream failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPolymarketLeaderboard(new URLSearchParams("category=unknown"))).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(getPolymarketLeaderboard(new URLSearchParams())).rejects.toThrow();
  });

  it("passes an opaque cursor and returns the next cursor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], pagination: { next_cursor: "next_123" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await getPolymarketLeaderboard(new URLSearchParams("period=day&cursor=abc_123"));
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("cursor")).toBe("abc_123");
    expect(page.nextCursor).toBe("next_123");
    await expect(getPolymarketLeaderboard(new URLSearchParams("cursor=invalid%2Fcursor"))).rejects.toThrow();
  });
});
