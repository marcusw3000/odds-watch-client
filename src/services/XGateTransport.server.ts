import { parseXGateCreatedDeposit, xgateDepositRequest } from './XGateProtocol.server';
import type { XGateDepositInput } from './XGateDeposit.server';

type Transport = (request: { method: 'POST'; path: string; body: unknown }) => Promise<{ status: number; body: unknown }>;

/** Injected transport only; no network connection is configured. */
export async function createXGateDepositForReconciliation(input: XGateDepositInput, send: Transport) {
  const request = xgateDepositRequest(input);
  let response: Awaited<ReturnType<Transport>>;
  try {
    response = await send(request);
  } catch {
    return { outcome: 'unknown' as const, externalId: input.externalId };
  }
  if (response.status !== 201) return { outcome: 'unknown' as const, externalId: input.externalId };
  try {
    return { outcome: 'created' as const, deposit: parseXGateCreatedDeposit(response.body, input.externalId) };
  } catch {
    return { outcome: 'unknown' as const, externalId: input.externalId };
  }
}
