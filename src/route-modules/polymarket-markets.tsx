import { useLoaderData } from "react-router";
import { PolymarketMarketsPage } from "@/pages/PolymarketMarketsPage";
import { listPolymarketCategory, listPolymarketMarkets, searchPolymarketMarkets } from "@/services/PolymarketMarketDataProvider.server";
import { browsePolymarketCache, parseCatalogFilters, type CatalogPage } from "@/services/PolymarketCatalogCache.server";
import { getPolymarketMarketAnalytics } from "@/services/PolymarketMarketAnalyticsProvider.server";
import { getUsdBrlFxQuote } from "@/services/UsdBrlFxProvider.server";
import { getPolymarketTags } from "@/services/PolymarketTags.server";
import { getPolymarketEvent } from "@/services/PolymarketEventProvider.server";
import { getEventPriceSeries } from "@/services/PolymarketEventAnalytics.server";
import type { Route } from "./+types/polymarket-markets";

export async function loader({ request }: Route.LoaderArgs) {
  const filters = parseCatalogFilters(new URL(request.url).searchParams);
  try {
    const fx = getUsdBrlFxQuote().catch((error) => {
      console.error("[Polymarket FX] Failed to load USD/BRL quote", error);
      return null;
    });
    const tags = getPolymarketTags(filters.category).catch(() => []);
    const data = await browsePolymarketCache(filters).catch(async (error): Promise<CatalogPage> => {
        console.error("[Polymarket cache] Failed to browse persistent catalog", error);
        // Legacy Gamma fallback cannot faithfully reproduce arbitrary filters or pagination.
        if (filters.page !== 1 || filters.status !== "open" || filters.sort !== "volume" || filters.minVolume || filters.endAfter || filters.endBefore || filters.subcategory || (filters.query && filters.category)) throw error;
        const fallback = filters.query.length >= 2 ? await searchPolymarketMarkets(filters.query)
          : filters.category ? await listPolymarketCategory(filters.category)
          : await listPolymarketMarkets({ limit: 24 });
        return { ...fallback, page: 1, hasNext: false, cacheComplete: null, lastSyncAt: null, cacheError: true };
      });
    const featured = (async () => {
      if (!data.markets[0] || filters.query || filters.page !== 1) return { analytics: null, featuredEvent: null, featuredSeries: [] };
      const [analytics, event] = await Promise.all([
        getPolymarketMarketAnalytics(data.markets[0]).catch(() => null),
        data.events?.[0] ? getPolymarketEvent(data.events[0].id).catch(() => null) : Promise.resolve(null),
      ]);
      const featuredSeries = event ? await getEventPriceSeries(event.markets, 24 * 30).catch(() => []) : [];
      const featuredEvent = event ? { ...event, markets: [...event.markets].sort((a, b) => Number(b.outcomes[0]?.price ?? 0) - Number(a.outcomes[0]?.price ?? 0)).slice(0, 4).map((market) => ({ ...market, description: null })) } : null;
      return { analytics, featuredEvent, featuredSeries };
    })();
    return { data, fx, filters, tags, featured, error: false };
  } catch (error) {
    console.error("[Polymarket Markets] Failed to load public market data", error);
    return { data: { source: "polymarket" as const, markets: [], nextCursor: null, fetchedAt: new Date().toISOString(), searchQuery: filters.query || null, totalMatches: null, page: filters.page, hasNext: false, cacheComplete: null, lastSyncAt: null }, fx: Promise.resolve(null), filters, tags: Promise.resolve([]), featured: Promise.resolve({ analytics: null, featuredEvent: null, featuredSeries: [] }), error: true };
  }
}

export const meta: Route.MetaFunction = () => [
  { title: "Polymarket | PredictMarket" },
  { name: "description", content: "Acompanhe dados públicos de mercados da Polymarket em modo somente leitura." },
];

export default function PolymarketMarketsRoute() {
  const { data, fx, filters, tags, featured, error } = useLoaderData<typeof loader>();
  return <PolymarketMarketsPage data={data} fx={fx} filters={filters} tags={tags} featured={featured} error={error} />;
}
