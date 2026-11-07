import { describe, expect, it, vi } from "vitest";
import { fetchConfirmedStatuses } from "../supabase/functions/_shared/polymarketStatus";

describe("Polymarket status reconciliation", () => {
  it.each(["markets", "events"] as const)("requests open and closed %s and ignores missing or unrequested records", async (kind) => {
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe(`/${kind}`);
      expect(url.searchParams.get("closed")).toBe("any");
      expect(url.searchParams.getAll("id")).toEqual(["10", "20", "30"]);
      return new Response(JSON.stringify([
        { id: "10", closed: false, acceptingOrders: true },
        { id: "20", closed: true, acceptingOrders: false },
        { id: "99", closed: true },
        { id: "30" },
      ]));
    });
    await expect(fetchConfirmedStatuses(kind, ["10", "20", "30"], 1000, request as typeof fetch)).resolves.toEqual([
      { id: "10", closed: false, acceptingOrders: true },
      { id: "20", closed: true, acceptingOrders: false },
    ]);
  });

  it("does not return a status on upstream errors", async () => {
    const request = vi.fn(async () => new Response("failure", { status: 503 }));
    await expect(fetchConfirmedStatuses("markets", ["10"], 1000, request as typeof fetch)).rejects.toThrow("503");
  });
});
