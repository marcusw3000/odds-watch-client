import { describe, expect, it } from 'vitest';
import { classifyXGateProgress, parseXGateCreatedDeposit, xgateDepositDetailsRequest, xgateDepositRequest, xgateLoginRequest } from '../src/services/XGateProtocol.server';

describe('XGate protocol preparation', () => {
  it('prepares documented requests without transport', () => {
    expect(xgateLoginRequest('user@example.com', 'secret')).toEqual({ method: 'POST', path: '/auth/token', body: { email: 'user@example.com', password: 'secret' } });
    expect(xgateDepositDetailsRequest('a/b').path).toBe('/deposit/a%2Fb/details');
    expect(xgateDepositRequest({ amountCents: 1000, customerId: 'c', currencyId: 'brl', externalId: 'e', companyWallet: `0x${'a'.repeat(40)}` }).path).toBe('/deposit');
  });
  it('accepts only a matching response containing the purchase instruction', () => {
    const data = { status: 'WAITING_PAYMENT', id: 'd', code: 'pix', externalId: 'e', purchase: { id: 'p', status: 'PENDING_PAYMENT' } };
    expect(parseXGateCreatedDeposit({ data }, 'e')).toEqual({ depositId: 'd', pixCode: 'pix', externalId: 'e', purchaseId: 'p' });
    for (const value of [null, { data: { ...data, externalId: 'other' } }, { data: { ...data, purchase: undefined } }, { data: { ...data, code: '' } }]) {
      expect(() => parseXGateCreatedDeposit(value, 'e')).toThrow(/concilie/);
    }
  });
  it('does not confuse a paid Pix with delivered USDC', () => {
    expect(classifyXGateProgress('PAID', 'EXECUTING')).toEqual({ pixPaid: true, purchaseDelivered: false, requiresReconciliation: true });
    expect(classifyXGateProgress('PAID', 'DELIVERED')).toEqual({ pixPaid: true, purchaseDelivered: true, requiresReconciliation: false });
    expect(classifyXGateProgress('unknown', 'DELIVERED').requiresReconciliation).toBe(true);
  });
});
