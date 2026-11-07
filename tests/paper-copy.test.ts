import { describe, expect, it } from "vitest";
import { inferSalePositions, sizePaperCopy } from "../supabase/functions/_shared/paperCopy";

describe("simulated copy sizing", () => {
  const base = { sourceNotional: 100, totalLimit: 50, spent: 15, perTradeLimit: 20, balance: 100, sourcePrice: 0.4, maxPriceDeviation: 0.03 };
  it("limits the worst-case fill to the per-trade cap", () => {
    const result = sizePaperCopy(base);
    expect(result.budget).toBe(20);
    expect(result.shares * result.limitPrice).toBeLessThanOrEqual(20);
  });
  it("respects remaining total limit, balance, and source size", () => {
    expect(sizePaperCopy({ ...base, spent: 49 }).budget).toBe(1);
    expect(sizePaperCopy({ ...base, balance: 2 }).budget).toBe(2);
    expect(sizePaperCopy({ ...base, sourceNotional: 3 }).budget).toBe(3);
  });
  it("rejects exhausted budgets and invalid prices", () => {
    expect(() => sizePaperCopy({ ...base, spent: 50 })).toThrow();
    expect(() => sizePaperCopy({ ...base, sourcePrice: NaN })).toThrow();
  });
});

describe("source sale position",()=>{
  it("reconstructs the position before a sale using later trades",()=>{
    const result=inferSalePositions([{key:"sale",side:"SELL",shares:40,time:10},{key:"buy",side:"BUY",shares:20,time:20}],80,20,25);
    expect(result.get("sale")).toBe(100);
  });
  it("rejects stale, future and ambiguous source snapshots",()=>{
    const trades=[{key:"a",side:"SELL" as const,shares:4,time:10},{key:"b",side:"BUY" as const,shares:2,time:10}];
    expect(()=>inferSalePositions(trades,8,10,10)).toThrow();
    expect(()=>inferSalePositions([trades[0]],8,9,10)).toThrow();
    expect(()=>inferSalePositions([trades[0]],8,11,10)).toThrow();
  });
});
