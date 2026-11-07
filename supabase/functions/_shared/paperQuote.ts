type Side = "BUY" | "SELL";
type Level = { price: number; size: number };

/** Full-fill simulation from the current public book. No order is submitted. */
export function quotePaperBook(book: unknown, token: string, shares: number, side: Side): number {
  if (!book || typeof book !== "object" || !Number.isFinite(shares) || shares <= 0) throw new Error("Livro de ofertas indisponível.");
  const payload = book as Record<string, unknown>;
  if (String(payload.asset_id ?? "") !== token) throw new Error("Livro de ofertas incompatível com o resultado.");
  const rows = side === "BUY" ? payload.asks : payload.bids;
  if (!Array.isArray(rows)) throw new Error("Livro de ofertas indisponível.");
  const levels: Level[] = rows.flatMap((entry): Level[] => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (record.price == null || record.size == null || record.price === "" || record.size === "") return [];
    const price = Number(record.price), size = Number(record.size);
    return Number.isFinite(price) && price > 0 && price <= 1 && Number.isFinite(size) && size > 0 ? [{ price, size }] : [];
  }).sort((a, b) => side === "BUY" ? a.price - b.price : b.price - a.price);
  let remaining = shares, total = 0;
  for (const level of levels) {
    const count = Math.min(remaining, level.size);
    total += count * level.price;
    remaining -= count;
    if (remaining <= 1e-9) break;
  }
  if (remaining > 1e-9) throw new Error("Liquidez insuficiente para esta operação simulada.");
  const price = Number((total / shares).toFixed(6));
  if (!Number.isFinite(price) || price <= 0 || price > 1) throw new Error("Preço simulado indisponível.");
  return price;
}

function stringArray(value: unknown): string[] {
  if (typeof value === "string") { try { return stringArray(JSON.parse(value)); } catch { return []; } }
  return Array.isArray(value) && value.every((v) => typeof v === "string") ? value : [];
}

export function resolvePaperMarket(payload: unknown, marketId: string, outcome: string): { token: string; question: string } {
  const rows = payload && typeof payload === "object" && "markets" in payload ? (payload as { markets: unknown }).markets : null;
  if (!Array.isArray(rows)) throw new Error("Mercado indisponível na Polymarket.");
  const value = rows.find((row) => row && typeof row === "object" && String(row.id) === marketId) as Record<string, unknown> | undefined;
  if (!value || value.closed === true || value.acceptingOrders !== true || typeof value.question !== "string" || !value.question.trim()) throw new Error("Mercado indisponível para simulação.");
  const labels = stringArray(value.outcomes), tokens = stringArray(value.clobTokenIds);
  const idx = labels.indexOf(outcome);
  const token = tokens[idx];
  if (idx < 0 || labels.lastIndexOf(outcome) !== idx || !token || !/^\d{1,100}$/.test(token)) throw new Error("Resultado não encontrado na Polymarket.");
  return { token, question: value.question.slice(0, 1000) };
}
