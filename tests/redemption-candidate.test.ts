import { describe, expect, it } from 'vitest';
import { classifyRedemptionPosition } from '../src/lib/redemptionCandidate';

describe('redemption candidate classification', () => {
  it('requires an explicit boolean and a positive balance', () => {
    expect(classifyRedemptionPosition({ redeemable: true, current_size: '2.5' }).state).toBe('candidate');
    expect(classifyRedemptionPosition({ redeemable: false, current_size: 1 }).state).toBe('not_redeemable');
    for (const value of [null, {}, { redeemable: 'true', current_size: 1 }, { redeemable: true, size: 1 }, { redeemable: true, current_size: '' }, { redeemable: true, current_size: 0 }, { redeemable: true, current_size: -1 }]) expect(classifyRedemptionPosition(value).state).toBe('unknown');
  });
});
