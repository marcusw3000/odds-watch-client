/** Pure accounting calculation in pUSD base units. Not a persistent ledger. */
export type SharedWalletBalance = { available: bigint; reserved: bigint };
export type BalanceAction = 'reserve' | 'release' | 'consume';

export function calculateSharedWalletBalance(balance: SharedWalletBalance, action: BalanceAction, amount: bigint): SharedWalletBalance {
  if (balance.available < 0n || balance.reserved < 0n || amount <= 0n) throw new Error('Saldo ou valor inválido.');
  if (action === 'reserve') {
    if (balance.available < amount) throw new Error('Saldo disponível insuficiente.');
    return { available: balance.available - amount, reserved: balance.reserved + amount };
  }
  if (action !== 'release' && action !== 'consume') throw new Error('Operação inválida.');
  if (balance.reserved < amount) throw new Error('Saldo reservado insuficiente.');
  return { available: balance.available + (action === 'release' ? amount : 0n), reserved: balance.reserved - amount };
}
