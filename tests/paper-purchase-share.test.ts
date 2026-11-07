import { describe, expect, it } from "vitest";
import { paperPurchaseShare } from "../src/lib/paperPurchaseShare";
import type { PolymarketMarket } from "../src/types/polymarket";

const market = { id: "123", question: "Um evento?", imageUrl: null } as PolymarketMarket;

describe("paper purchase share", () => {
  it.each(["Yes", "No"])("uses the confirmed execution for %s purchases", outcome => {
    expect(paperPurchaseShare(market, outcome, "BUY", 10.125, { success: true, price: 0.443 })).toEqual({
      marketId: "123", question: "Um evento?", imageUrl: null, outcome, shares: 10.125, price: 0.443,
    });
  });
  it("does not create a card for sales, failures, or invalid prices", () => {
    expect(paperPurchaseShare(market, "Yes", "SELL", 1, { success: true, price: 0.5 })).toBeNull();
    expect(paperPurchaseShare(market, "Yes", "BUY", 1, { success: false, price: 0.5 })).toBeNull();
    expect(paperPurchaseShare(market, "Yes", "BUY", 1, { success: true, price: null })).toBeNull();
  });
});
