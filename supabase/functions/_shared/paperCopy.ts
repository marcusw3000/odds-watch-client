/** Conservative sizing for a simulated copy. All amounts are virtual USD. */
export function sizePaperCopy(input: { sourceNotional: number; totalLimit: number; spent: number; perTradeLimit: number; balance: number; sourcePrice: number; maxPriceDeviation: number }) {
  const { sourceNotional, totalLimit, spent, perTradeLimit, balance, sourcePrice, maxPriceDeviation } = input;
  if (![sourceNotional, totalLimit, spent, perTradeLimit, balance, sourcePrice, maxPriceDeviation].every(Number.isFinite) || sourceNotional <= 0 || totalLimit <= 0 || spent < 0 || perTradeLimit <= 0 || balance < 0 || sourcePrice <= 0 || sourcePrice > 1 || maxPriceDeviation < 0 || maxPriceDeviation > 1) throw new Error("Parâmetros de cópia inválidos.");
  const budget = Math.min(sourceNotional, Math.max(0, totalLimit - spent), perTradeLimit, balance);
  const limitPrice = Math.min(1, sourcePrice + maxPriceDeviation);
  // Size at the worst permitted price, so the actual full-fill quote cannot exceed any cap.
  const shares = Math.floor((budget / limitPrice) * 1_000_000) / 1_000_000;
  if (shares <= 0 || shares * limitPrice < 0.000001) throw new Error("Limite ou saldo virtual insuficiente.");
  return { shares, limitPrice, budget };
}

export type SourceMovement = { key: string; side: "BUY" | "SELL"; shares: number; time: number };
/** Walk backwards from a confirmed current position. Same-second movements cannot be safely ordered. */
export function inferSalePositions(movements: SourceMovement[], currentShares: number, lastEvent: number, cutoff: number): Map<string, number> {
  if (!Number.isFinite(currentShares) || currentShares < 0 || !Number.isFinite(lastEvent) || lastEvent > cutoff || movements.some(m => !Number.isFinite(m.shares) || m.shares <= 0 || !Number.isFinite(m.time))) throw new Error("Posição de origem indisponível");
  const ordered = [...movements].sort((a,b)=>b.time-a.time);
  if (ordered.length && lastEvent < ordered[0].time) throw new Error("Posição de origem ainda não está atualizada");
  if (ordered.some((m,i)=>i>0 && ordered[i-1].time===m.time && ordered[i-1].key!==m.key)) throw new Error("Ordem das operações de origem é ambígua");
  let shares=currentShares; const result=new Map<string,number>();
  for(const movement of ordered) {
    if(movement.side==="SELL") { const before=shares+movement.shares; if(before<=0 || movement.shares>before+0.000001)throw new Error("Posição de origem inválida"); result.set(movement.key,before); shares=before; }
    else { shares-=movement.shares; if(shares< -0.00001)throw new Error("Histórico de posição inconsistente"); shares=Math.max(0,shares); }
  }
  return result;
}
