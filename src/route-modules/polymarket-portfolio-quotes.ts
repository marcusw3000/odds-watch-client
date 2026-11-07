import { getPolymarketMarket } from '@/services/PolymarketMarketDataProvider.server';
import type { Route } from './+types/polymarket-portfolio-quotes';

export async function action({ request }: Route.ActionArgs) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dados inválidos.' }, { status: 400 }); }
  const ids = (body as { marketIds?: unknown })?.marketIds;
  if (!Array.isArray(ids) || ids.length > 50 || ids.some(id => typeof id !== 'string' || !/^\d{1,20}$/.test(id))) return Response.json({ error: 'Mercados inválidos.' }, { status: 400 });
  const unique = [...new Set(ids)] as string[];
  const markets: Array<{ marketId: string; outcomes: Array<{ label: string; tokenId: string | null; price: string | null }> } | null> = [];
  for (let i = 0; i < unique.length; i += 5) {
    const batch = await Promise.all(unique.slice(i, i + 5).map(async marketId => {
      try {
        const market = await getPolymarketMarket(marketId);
        return market ? { marketId, outcomes: market.outcomes.map(({ label, tokenId, price }) => ({ label, tokenId, price })) } : null;
      } catch { return null; }
    }));
    markets.push(...batch);
  }
  return Response.json({ markets: markets.filter(Boolean) }, { headers: { 'Cache-Control': 'no-store' } });
}
