import { describe, expect, it, vi } from "vitest";
import { createClosureHandler } from "../supabase/functions/_shared/closureHandler";

describe("Polymarket closure checks", () => {
  it("notifies only explicitly confirmed closed markets", async () => {
    const record = vi.fn().mockResolvedValue({ data: 1, error: null });
    const handler = createClosureHandler({ secret: "secret", candidates: async () => ({ data: [{ market_id: "1" }, { market_id: "2" }, { market_id: "3" }], error: null }), record, fetcher: vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: "1", closed: true }, { id: "2", closed: false }]), { status: 200 })) });
    const result = await handler(new Request("https://example.test", { method: "POST", headers: { Authorization: "Bearer secret" } }));
    expect(result.status).toBe(200);
    expect(record).toHaveBeenCalledWith(["1", "2", "3"], ["1"]);
  });
  it("rejects unauthorized requests and never records failed upstream responses", async () => {
    const record = vi.fn();
    const handler = createClosureHandler({ secret: "secret", candidates: async () => ({ data: [{ market_id: "1" }], error: null }), record, fetcher: vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })) });
    expect((await handler(new Request("https://example.test", { method: "POST" }))).status).toBe(401);
    expect((await handler(new Request("https://example.test", { method: "POST", headers: { Authorization: "Bearer secret" } }))).status).toBe(503);
    expect(record).not.toHaveBeenCalled();
  });
});
