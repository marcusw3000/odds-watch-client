import { describe, expect, it } from 'vitest';
import { valuePaperPositions } from '../src/lib/paperValuation';

describe('paper portfolio valuation', () => {
  const market = { marketId: '1', outcomes: [{ label: 'Yes', tokenId: 'yes', price: '0.4' }, { label: 'No', tokenId: 'no', price: '0.6' }] };
  it('sums each position using its own outcome price', () => {
    expect(valuePaperPositions([{ market_id: '1', outcome_label: 'Yes', outcome_token_id: 'yes', shares: 10 }, { market_id: '1', outcome_label: 'No', outcome_token_id: 'no', shares: 5 }], [market])).toEqual({ values: [4, 3], total: 7 });
  });
  it('does not show a partial total when a quote is missing or a token differs', () => {
    expect(valuePaperPositions([{ market_id: '1', outcome_label: 'Yes', outcome_token_id: 'unexpected', shares: 10 }], [market]).total).toBeNull();
    expect(valuePaperPositions([{ market_id: '2', outcome_label: 'Yes', outcome_token_id: null, shares: 10 }], [market]).total).toBeNull();
  });
  it('accepts a confirmed zero price and empty portfolios', () => {
    expect(valuePaperPositions([{ market_id: '1', outcome_label: 'Yes', outcome_token_id: null, shares: 5 }], [{ ...market, outcomes: [{ label: 'Yes', tokenId: null, price: '0' }] }]).total).toBe(0);
    expect(valuePaperPositions([], []).total).toBe(0);
  });
  it('treats blank prices and share quantities as unavailable', () => {
    const position = { market_id: '1', outcome_label: 'Yes', outcome_token_id: null, shares: 5 };
    expect(valuePaperPositions([position], [{ ...market, outcomes: [{ label: 'Yes', tokenId: null, price: '  ' }] }]).total).toBeNull();
    expect(valuePaperPositions([{ ...position, shares: '  ' }], [market]).total).toBeNull();
  });
  it('handles malformed remote outcomes without inventing a price or crashing', () => {
    const position = { market_id: '1', outcome_label: 'Yes', outcome_token_id: null, shares: 5 };
    expect(valuePaperPositions([position], [{ marketId: '1', outcomes: null } as unknown as typeof market]).total).toBeNull();
    expect(valuePaperPositions([position], [{ marketId: '1', outcomes: [null, { label: 'Yes', tokenId: null, price: {} }] } as unknown as typeof market]).total).toBeNull();
  });
});
