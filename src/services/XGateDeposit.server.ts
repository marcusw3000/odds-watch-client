/** Preparation only. No network request or financial action is performed here. */
export type XGateDepositInput = {
  amountCents: number;
  customerId: string;
  currencyId: string;
  externalId: string;
  companyWallet: string;
};

export function prepareXGateDeposit(input: XGateDepositInput) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 ||
      !input.customerId.trim() || !input.currencyId.trim() || !input.externalId.trim() ||
      !/^0x[a-fA-F0-9]{40}$/.test(input.companyWallet)) {
    throw new Error('Dados inválidos para preparar depósito XGate.');
  }
  return {
    amount: input.amountCents / 100,
    customerId: input.customerId,
    currency: { _id: input.currencyId, name: 'BRL', type: 'PIX', symbol: 'R$' },
    purchase: { asset: 'USDC', network: 'POLYGON', address: input.companyWallet },
    externalId: input.externalId,
  };
}
