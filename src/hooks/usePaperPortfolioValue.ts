import { useQuery } from '@tanstack/react-query';
import { valuePaperPositions, type PaperMarketQuote, type PaperPositionValue } from '@/lib/paperValuation';

export function usePaperPortfolioValue(positions: PaperPositionValue[] | undefined) {
  const ids = [...new Set((positions ?? []).map(position => position.market_id))].sort();
  const query = useQuery({
    queryKey: ['paper-portfolio-quotes', ids],
    enabled: Boolean(positions) && ids.length > 0,
    staleTime: 30000,
    refetchInterval: 30000,
    queryFn: async () => {
      const markets: PaperMarketQuote[] = [];
      for (let i = 0; i < ids.length; i += 5) {
        const response = await fetch('/api/polymarket/portfolio-quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketIds: ids.slice(i, i + 5) }) });
        if (!response.ok) throw new Error('Cotações indisponíveis');
        const data = await response.json();
        if (!Array.isArray(data.markets)) throw new Error('Cotações inválidas');
        markets.push(...data.markets);
      }
      return markets;
    },
  });
  const valuation = positions && !query.isError ? valuePaperPositions(positions, query.data ?? []) : null;
  return { ...query, total: valuation?.total ?? (positions?.length === 0 ? 0 : null), values: valuation?.values ?? [], isValuationLoading: Boolean(positions?.length && query.isLoading) };
}
