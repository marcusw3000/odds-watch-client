import type { PolymarketOrderBookLevel } from "@/types/polymarket";

/** Estimate a complete simulated fill from the visible book; this does not place an order. */
export function previewPaperExecution(levels: PolymarketOrderBookLevel[], shares: number, side: "BUY" | "SELL") {
  if (!Number.isFinite(shares) || shares <= 0) return null;
  const valid = levels.map((level) => ({ price: Number(level.price), size: Number(level.size) }))
    .filter(({ price, size }) => Number.isFinite(price) && price > 0 && price <= 1 && Number.isFinite(size) && size > 0)
    .sort((a, b) => side === "BUY" ? a.price - b.price : b.price - a.price);
  if (!valid.length) return null;
  let remaining = shares;
  let cost = 0;
  for (const level of valid) {
    const filled = Math.min(remaining, level.size);
    cost += filled * level.price;
    remaining -= filled;
    if (remaining <= 1e-9) break;
  }
  return { complete: remaining <= 1e-9, available: shares - remaining, price: cost / (shares - remaining), total: cost };
}
