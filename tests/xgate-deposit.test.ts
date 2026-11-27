import { describe, expect, it } from 'vitest';
import { prepareXGateDeposit } from '../src/services/XGateDeposit.server';

const input = { amountCents: 10050, customerId: 'customer', currencyId: 'currency', externalId: 'deposit-1', companyWallet: `0x${'a'.repeat(40)}` };

describe('XGate deposit preparation', () => {
  it('prepares the documented Pix purchase without making a request', () => {
    expect(prepareXGateDeposit(input)).toEqual({
      amount: 100.5, customerId: 'customer',
      currency: { _id: 'currency', name: 'BRL', type: 'PIX', symbol: 'R$' },
      purchase: { asset: 'USDC', network: 'POLYGON', address: input.companyWallet },
      externalId: 'deposit-1',
    });
  });
  it('rejects invalid amounts, identifiers and wallet addresses', () => {
    for (const change of [{ amountCents: 0 }, { amountCents: 1.5 }, { externalId: ' ' }, { customerId: '' }, { currencyId: '' }, { companyWallet: '0x123' }]) {
      expect(() => prepareXGateDeposit({ ...input, ...change })).toThrow();
    }
  });
});
