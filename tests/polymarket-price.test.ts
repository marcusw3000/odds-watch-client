import { describe, expect, it } from 'vitest';
import { isValidPolymarketPrice } from '../src/lib/polymarketPrice';

describe('public market prices', () => {
  it('accepts valid probabilities including zero', () => {
    for (const value of ['0', '0.4', '1']) expect(isValidPolymarketPrice(value)).toBe(true);
  });
  it('rejects missing, invalid and out-of-range prices', () => {
    for (const value of [null, undefined, '', '  ', 'NaN', '-0.1', '1.1', {}, 0]) expect(isValidPolymarketPrice(value)).toBe(false);
  });
});
