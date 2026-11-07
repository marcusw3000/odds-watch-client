import { useLoaderData } from "react-router";
import { PolymarketMarketDetailPage } from "@/pages/PolymarketMarketDetailPage";
import { getPolymarketMarket } from "@/services/PolymarketMarketDataProvider.server";
import { getPolymarketMarketAnalytics } from "@/services/PolymarketMarketAnalyticsProvider.server";
import { getUsdBrlFxQuote } from "@/services/UsdBrlFxProvider.server";
import { getMarketInsights } from "@/services/PolymarketInsights.server";
import { getPolymarketEventComments } from "@/services/PolymarketPublicComments.server";
import type { Route } from "./+types/polymarket-market-detail";

export async function loader({ params, request }: Route.LoaderArgs) {
  const id = params.id ?? "";
  try {
    const market = await getPolymarketMarket(id);
    const [fx, analytics, insights, commentsResult] = await Promise.all([
      getUsdBrlFxQuote().catch((error) => {
        console.error("[Polymarket FX] Failed to load USD/BRL quote", error);
        return null;
      }),
      market ? getPolymarketMarketAnalytics(market, new URL(request.url).searchParams.get("outcome")).catch((error) => {
        console.error("[Polymarket analytics] Failed to load public analytics", error);
        return null;
      }) : Promise.resolve(null),
      getMarketInsights(market?.conditionId ?? null),
      market?.eventId ? getPolymarketEventComments(market.eventId).then((comments) => ({ comments, error: false })).catch(() => ({ comments: [], error: true })) : Promise.resolve({ comments: [], error: false }),
    ]);
    return { market, fx, analytics, insights, commentsResult };
  } catch (error) {
    console.error("[Polymarket Market] Failed to load public market data", error);
    return { market: null, fx: null, analytics: null, insights: null, commentsResult: { comments: [], error: false } };
  }
}

export const meta: Route.MetaFunction = ({ data }) => [
  { title: data?.market ? `${data.market.question} | Polymarket` : "Mercado não encontrado | Polymarket" },
  { name: "description", content: "Dados públicos da Polymarket em modo somente leitura." },
];

export default function PolymarketMarketDetailRoute() {
  const { market, fx, analytics, insights, commentsResult } = useLoaderData<typeof loader>();
  return <PolymarketMarketDetailPage market={market} fx={fx} analytics={analytics} insights={insights} commentsResult={commentsResult} />;
}
