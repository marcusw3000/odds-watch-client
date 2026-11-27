export interface PaperPositionValue { market_id: string; outcome_label: string; outcome_token_id: string | null; shares: number | string }
export interface PaperMarketQuote { marketId: string; quoteOrigin?: 'gamma' | 'persistent_cache'; quoteObservedAt?: string | null; outcomes: Array<{ label: string; tokenId: string | null; price: string | null }> }

export function valuePaperPositions(positions: PaperPositionValue[], markets: PaperMarketQuote[]) {
  const values = positions.map(position => {
    const market = markets.find(item => item.marketId === position.market_id);
    const outcomes = Array.isArray(market?.outcomes) ? market.outcomes.filter(item => item != null && typeof item === 'object') : [];
    const token = position.outcome_token_id;
    const outcome = token && outcomes.some(item => item.tokenId) ? outcomes.find(item => item.tokenId === token) : outcomes.find(item => item.label === position.outcome_label);
    const price = typeof outcome?.price !== 'string' || outcome.price.trim() === '' ? NaN : Number(outcome.price);
    const shares = typeof position.shares === 'number' || (typeof position.shares === 'string' && position.shares.trim() !== '') ? Number(position.shares) : NaN;
    return Number.isFinite(price) && price >= 0 && price <= 1 && Number.isFinite(shares) && shares >= 0 ? shares * price : null;
  });
  return { values, total: values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0) };
}
