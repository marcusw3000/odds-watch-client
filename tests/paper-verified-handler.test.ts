import { describe, expect, it, vi } from "vitest";
import { createPaperHandler, type PaperHandlerDependencies } from "../supabase/functions/_shared/paperHandler";

const user = "8bf77056-eaa6-471a-9bba-3e2ef09c3932";
const input = { marketId: "77", outcome: "Yes", side: "BUY", requestId: "5b6ab0ff-cae8-47e8-a74e-d32499c35c02", roundId: "4788abf8-4844-442a-9e03-6fcac9c0d129", shares: 10, limitPrice: 0.6 };
const request = (body = input, token = true) => new Request("https://example.test", { method: "POST", headers: token ? { Authorization: "Bearer fake", "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function deps(): PaperHandlerDependencies {
  return { cors: {}, authenticate: vi.fn(async () => user), previous: vi.fn(async () => ({ data: null, error: null })), execute: vi.fn(async () => ({ data: { success: true }, error: null })), fetcher: vi.fn(async (value) => {
    if (String(value).includes("gamma-api")) return new Response(JSON.stringify({ markets: [{ id: "77", question: "Question", acceptingOrders: true, outcomes: '["Yes","No"]', clobTokenIds: '["123","456"]' }] }));
    return new Response(JSON.stringify({ asset_id: "123", asks: [{ price: "0.5", size: "10" }], bids: [] }));
  }) as typeof fetch };
}
describe("authenticated verified paper handler", () => {
  it("rejects unauthenticated requests before touching the database", async () => {
    const d = deps(); const response = await createPaperHandler(d)(request(input, false));
    expect(response.status).toBe(401); expect(d.previous).not.toHaveBeenCalled();
  });
  it("derives the token and price server-side, ignoring a supplied client price", async () => {
    const d = deps(); const response = await createPaperHandler(d)(request({ ...input, p_price: 0.001 } as typeof input));
    expect(response.status).toBe(200); expect(d.execute).toHaveBeenCalledWith(expect.objectContaining({ p_user: user, p_token: "123", p_price: 0.5 }));
  });
  it("returns the earlier result without fetching a new book", async () => {
    const d = deps(); d.previous = vi.fn(async () => ({ data: { success: true }, error: null }));
    expect((await createPaperHandler(d)(request())).status).toBe(200); expect(d.fetcher).not.toHaveBeenCalled(); expect(d.execute).not.toHaveBeenCalled();
  });
  it("rejects insufficient liquidity and changed quotes without recording a trade", async () => {
    const d = deps(); expect((await createPaperHandler(d)(request({ ...input, shares: 11 }))).status).toBe(503); expect(d.execute).not.toHaveBeenCalled();
    expect((await createPaperHandler(d)(request({ ...input, limitPrice: 0.49 }))).status).toBe(503); expect(d.execute).not.toHaveBeenCalled();
  });
  it("does not execute when the external API is unavailable", async () => {
    const d = deps(); d.fetcher = vi.fn(async () => new Response("", { status: 503 })) as typeof fetch;
    expect((await createPaperHandler(d)(request())).status).toBe(503); expect(d.execute).not.toHaveBeenCalled();
  });
});
