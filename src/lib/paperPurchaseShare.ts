import type { PolymarketMarket } from "@/types/polymarket";

export interface PaperPurchaseShare {
  marketId: string;
  question: string;
  imageUrl: string | null;
  outcome: string;
  shares: number;
  price: number;
}

export function paperPurchaseShare(market: PolymarketMarket, outcome: string, side: "BUY" | "SELL", shares: number, result: { success?: boolean; price?: unknown }): PaperPurchaseShare | null {
  const price = typeof result.price === "number" ? result.price : NaN;
  if (side !== "BUY" || result.success !== true || !Number.isFinite(price) || price <= 0 || price > 1 || !Number.isFinite(shares) || shares <= 0) return null;
  return { marketId: market.id, question: market.question, imageUrl: market.imageUrl, outcome, shares, price };
}
