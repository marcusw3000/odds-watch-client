import { describe, expect, it } from "vitest";
import { quotePaperBook, resolvePaperMarket } from "../supabase/functions/_shared/paperQuote";

describe("verified paper execution", () => {
  const book = { asset_id: "123", asks: [{ price: "0.6", size: "5" }, { price: "0.5", size: "5" }], bids: [{ price: "0.3", size: "6" }, { price: "0.4", size: "4" }] };
  it("uses the correct side and calculates a full weighted fill", () => {
    expect(quotePaperBook(book, "123", 8, "BUY")).toBe(0.5375);
    expect(quotePaperBook(book, "123", 8, "SELL")).toBe(0.35);
  });
  it("rejects insufficient liquidity, missing books and mismatched assets", () => {
    expect(() => quotePaperBook(book, "123", 11, "BUY")).toThrow(/Liquidez/);
    expect(() => quotePaperBook({}, "123", 1, "BUY")).toThrow();
    expect(() => quotePaperBook(book, "124", 1, "BUY")).toThrow(/incompatível/);
  });
  it("uses the market's token and refuses closed or mismatched markets", () => {
    const market = { id: "77", question: "Question?", acceptingOrders: true, closed: false, outcomes: '["Yes","No"]', clobTokenIds: '["123","456"]' };
    expect(resolvePaperMarket({ markets: [market] }, "77", "No")).toEqual({ token: "456", question: "Question?" });
    expect(() => resolvePaperMarket({ markets: [market] }, "77", "Other")).toThrow();
    expect(() => resolvePaperMarket({ markets: [{ ...market, closed: true }] }, "77", "Yes")).toThrow();
    expect(() => resolvePaperMarket({ markets: [market] }, "78", "Yes")).toThrow();
  });
});
