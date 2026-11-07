import { useLoaderData } from "react-router";
import { PolymarketEventPage } from "@/pages/PolymarketEventPage";
import { getPolymarketEvent } from "@/services/PolymarketEventProvider.server";
import { getPolymarketEventComments } from "@/services/PolymarketPublicComments.server";
import { EVENT_CHART_INTERVALS, getEventChartSeries, type EventChartInterval } from "@/services/PolymarketEventAnalytics.server";
import { getEventLiveVolume } from "@/services/PolymarketInsights.server";
import type { Route } from "./+types/polymarket-event-detail";

export async function loader({ params, request }: Route.LoaderArgs) {
  const requested = new URL(request.url).searchParams.get("period");
  const period: EventChartInterval = EVENT_CHART_INTERVALS.includes(requested as EventChartInterval) ? requested as EventChartInterval : "max";
  try {
    const event = await getPolymarketEvent(params.id ?? "");
    const comments = event ? getPolymarketEventComments(event.id).then((items) => ({ items, error: false })).catch(() => ({ items: [], error: true })) : Promise.resolve({ items: [], error: false });
    const series = event ? getEventChartSeries(event.markets, period).catch(() => []) : Promise.resolve([]);
    const liveVolume = event ? getEventLiveVolume(event.id).catch(() => null) : Promise.resolve(null);
    const displayEvent = event ? { ...event, markets: event.markets.map((market) => ({ ...market, description: null, imageUrl: null, conditionId: null, outcomes: market.outcomes.map((outcome) => ({ ...outcome, tokenId: null, positionId: null })) })) } : null;
    return { event: displayEvent, failed: false, comments, series, liveVolume, period };
  } catch (error) {
    console.error("[Polymarket Event] Failed to load event", error);
    return { event: null, failed: true, comments: Promise.resolve({ items: [], error: true }), series: Promise.resolve([]), liveVolume: Promise.resolve(null), period };
  }
}
export const meta: Route.MetaFunction = ({ data }) => [{ title: data?.event ? `${data.event.title} | Polymarket` : "Evento | Polymarket" }];
export default function PolymarketEventDetailRoute() {
  const { event, failed, comments, series, liveVolume, period } = useLoaderData<typeof loader>();
  return <PolymarketEventPage key={event?.id ?? "missing"} event={event} failed={failed} comments={comments} series={series} liveVolume={liveVolume} period={period} />;
}
