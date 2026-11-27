import { describe, expect, it, vi } from 'vitest';
import { createXGateDepositForReconciliation } from '../src/services/XGateTransport.server';

const input = { amountCents: 1000, customerId: 'c', currencyId: 'brl', externalId: 'e', companyWallet: `0x${'a'.repeat(40)}` };
const body = { data: { status: 'WAITING_PAYMENT', id: 'd', code: 'pix', externalId: 'e', purchase: { id: 'p', status: 'PENDING_PAYMENT' } } };

describe('XGate injected transport', () => {
  it('returns the created deposit after one request', async () => {
    const send = vi.fn().mockResolvedValue({ status: 201, body });
    expect(await createXGateDepositForReconciliation(input, send)).toMatchObject({ outcome: 'created', deposit: { depositId: 'd', purchaseId: 'p' } });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('never retries an uncertain request', async () => {
    for (const send of [vi.fn().mockRejectedValue(new Error('timeout')), vi.fn().mockResolvedValue({ status: 500, body: {} }), vi.fn().mockResolvedValue({ status: 201, body: {} })]) {
      expect(await createXGateDepositForReconciliation(input, send)).toEqual({ outcome: 'unknown', externalId: 'e' });
      expect(send).toHaveBeenCalledTimes(1);
    }
  });
});
