import { getPolymarketMarket } from "@/services/PolymarketMarketDataProvider.server";
import type { Route } from "./+types/polymarket-share-market";

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.id || !/^\d{1,20}$/.test(params.id)) return Response.json({ error: "Mercado inválido." }, { status: 400 });
  try {
    const market = await getPolymarketMarket(params.id);
    if (!market) return Response.json({ error: "Mercado indisponível." }, { status: 404 });
    return Response.json({ question: market.question, imageUrl: market.imageUrl }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch {
    return Response.json({ error: "Mercado temporariamente indisponível." }, { status: 503 });
  }
}
