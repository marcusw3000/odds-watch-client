import { prepareXGateDeposit, type XGateDepositInput } from './XGateDeposit.server';

// Request descriptors only: the integration has no network transport or public route.
export function xgateLoginRequest(email: string, password: string) {
  if (!email.trim() || !password) throw new Error('Credenciais XGate ausentes.');
  return { method: 'POST' as const, path: '/auth/token', body: { email, password } };
}

export function xgateDepositRequest(input: XGateDepositInput) {
  return { method: 'POST' as const, path: '/deposit', body: prepareXGateDeposit(input) };
}

export function xgateDepositDetailsRequest(id: string) {
  if (!id.trim()) throw new Error('Identificador XGate ausente.');
  return { method: 'GET' as const, path: `/deposit/${encodeURIComponent(id)}/details` };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** An invalid or ambiguous response must be reconciled, never retried as a new deposit. */
export function parseXGateCreatedDeposit(value: unknown, expectedExternalId: string) {
  const data = record(record(value)?.data);
  const purchase = record(data?.purchase);
  if (!data || data.status !== 'WAITING_PAYMENT' || data.externalId !== expectedExternalId ||
      typeof data.id !== 'string' || !data.id.trim() || typeof data.code !== 'string' || !data.code.trim() ||
      !purchase || typeof purchase.id !== 'string' || !purchase.id.trim() || purchase.status !== 'PENDING_PAYMENT') {
    throw new Error('Resposta XGate inconclusiva; concilie antes de tentar novamente.');
  }
  return { depositId: data.id, pixCode: data.code, externalId: expectedExternalId, purchaseId: purchase.id };
}

/** Provider observations are not authorization to credit a user or execute a trade. */
export function classifyXGateProgress(depositStatus: unknown, purchaseStatus: unknown) {
  const pixPaid = depositStatus === 'PAID';
  const purchaseDelivered = purchaseStatus === 'DELIVERED';
  return { pixPaid, purchaseDelivered, requiresReconciliation: !pixPaid || !purchaseDelivered };
}
