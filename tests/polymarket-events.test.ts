import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPriorityEvents, syncEventPage } from "../supabase/functions/_shared/polymarketEvents";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const event = {
  id: "999", title: "Election", slug: "election", volume24hr: 42,
  tags: [{ slug: "politics" }, { slug: "elections" }],
  markets: [{ id: "123", question: "Will Alice win?" }, { id: "124", question: "Will Bob win?" }],
};
const mapMarket = (record: { id: string }) => ({ source: "polymarket", market_id: record.id });

describe("Polymarket event synchronization", () => {
  it("maps complete events, tags and distinct market IDs before committing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ events: [event], next_cursor: "next" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await syncEventPage("previous", mapMarket);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/events/keyset");
    expect(url.searchParams.get("after_cursor")).toBe("previous");
    expect(result.events[0]).toMatchObject({ event_id: "999", tags: ["politics", "elections"], volume_24h_usd: 42 });
    expect(result.events[0]?.source_payload).toEqual({});
    expect(result.events[0]?.search_text).toContain("Will Bob win?");
    expect(result.markets).toEqual([{ source: "polymarket", market_id: "123", event_id: "999" }, { source: "polymarket", market_id: "124", event_id: "999" }]);
    expect(result.nextCursor).toBe("next");
  });

  it("rejects malformed pages and a repeated cursor before checkpointing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ events: [event], next_cursor: "same" }), { status: 200 })));
    await expect(syncEventPage("same", mapMarket)).rejects.toThrow("repeated event cursor");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ events: [{ id: "999", title: "Election" }] }), { status: 200 })));
    await expect(syncEventPage(null, mapMarket)).rejects.toThrow("incomplete event");
  });

  it("prioritizes events by 24-hour volume without changing the full-scan cursor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([event]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchPriorityEvents(mapMarket);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/events");
    expect(url.searchParams.get("order")).toBe("volume24hr");
    expect(result.events[0]?.event_id).toBe("999");
    expect(result.markets).toHaveLength(2);
  });
});

describe("Polymarket event detail", () => {
  it("loads an event by event ID and preserves its individual market IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...event, markets: [{ id: "123", question: "Will Alice win?", outcomes: '["Yes","No"]', outcomePrices: '["0.8","0.2"]' }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getPolymarketEvent } = await import("@/services/PolymarketEventProvider.server");
    const result = await getPolymarketEvent("999");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://gamma-api.polymarket.com/events/999");
    expect(result).toMatchObject({ id: "999", markets: [{ id: "123", outcomes: [{ label: "Yes", price: "0.8" }, { label: "No", price: "0.2" }] }] });
  });
});
