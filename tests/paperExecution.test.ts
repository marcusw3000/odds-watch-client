import { describe, expect, it } from "vitest";
import { previewPaperExecution } from "@/lib/paperExecution";

describe("previewPaperExecution", () => {
  const levels = [{ price: "0.6", size: "5" }, { price: "0.5", size: "5" }];
  it("uses cheapest asks for a purchase and computes a weighted average", () => {
    expect(previewPaperExecution(levels, 8, "BUY")).toMatchObject({ complete: true, total: 4.3, available: 8 });
  });
  it("uses highest bids for a sale", () => {
    expect(previewPaperExecution(levels, 8, "SELL")?.total).toBeCloseTo(4.5);
  });
  it("does not pretend to fill more than visible depth", () => {
    expect(previewPaperExecution(levels, 11, "BUY")).toMatchObject({ complete: false, available: 10 });
    expect(previewPaperExecution([], 1, "BUY")).toBeNull();
  });
});
