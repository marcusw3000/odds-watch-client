import { describe, expect, it } from 'vitest';
import { calculateSharedWalletBalance } from '../src/services/SharedWalletAccounting.server';

describe('shared wallet individual accounting', () => {
  it('reserves, partially consumes and releases only the remaining funds', () => {
    const reserved = calculateSharedWalletBalance({ available: 100n, reserved: 0n }, 'reserve', 80n);
    const filled = calculateSharedWalletBalance(reserved, 'consume', 50n);
    expect(calculateSharedWalletBalance(filled, 'release', 30n)).toEqual({ available: 50n, reserved: 0n });
  });
  it('rejects overdrafts and invalid amounts', () => {
    const balance = { available: 10n, reserved: 5n };
    expect(() => calculateSharedWalletBalance(balance, 'reserve', 11n)).toThrow();
    expect(() => calculateSharedWalletBalance(balance, 'consume', 6n)).toThrow();
    expect(() => calculateSharedWalletBalance(balance, 'release', 0n)).toThrow();
  });
});
