import { describe, expect, it } from 'vitest';
import { paperPositionProfit, summarizePaperHistory } from '../src/lib/paperAnalytics';

describe('paper portfolio analytics', () => {
  it('uses only available samples for period change', () => {
    expect(summarizePaperHistory([])).toBeNull();
    expect(summarizePaperHistory([{ time: 10, value: -2 }])?.change).toBeNull();
    expect(summarizePaperHistory([{ time: 10, value: -2 }, { time: 50, value: 3 }])).toMatchObject({ count: 2, change: 5 });
  });
  it('does not invent a position result when its quote or cost is unavailable', () => {
    expect(paperPositionProfit(null, 10)).toBeNull();
    expect(paperPositionProfit(0, 10)).toBe(-10);
    expect(paperPositionProfit(5, NaN)).toBeNull();
  });
});
