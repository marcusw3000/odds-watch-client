/** Read-only classification. This does not authorize or execute a redemption. */
export type RedemptionCandidate = { state: 'candidate' | 'not_redeemable' | 'unknown'; reason: string };

export function classifyRedemptionPosition(input: unknown): RedemptionCandidate {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { state: 'unknown', reason: 'Dados da posição indisponíveis.' };
  const position = input as Record<string, unknown>;
  if (position.redeemable === false) return { state: 'not_redeemable', reason: 'A fonte ainda não indica resgate disponível.' };
  if (position.redeemable !== true) return { state: 'unknown', reason: 'Disponibilidade de resgate não confirmada.' };
  const amount = position.current_size;
  if ((typeof amount !== 'string' && typeof amount !== 'number') || (typeof amount === 'string' && !amount.trim()) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return { state: 'unknown', reason: 'Quantidade da posição inválida.' };
  return { state: 'candidate', reason: 'A fonte indica resgate disponível; autorização, saldo e protocolo ainda precisam de confirmação.' };
}
