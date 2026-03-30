import { useLoaderData } from "react-router";
import { MarketsPage } from "@/pages/MarketsPage";
import { MarketDataProvider } from "@/services/MarketDataProvider";
import type { Route } from "./+types/markets";

export async function loader(_args: Route.LoaderArgs) {
  const [events, categories] = await Promise.all([
    MarketDataProvider.getEvents(),
    MarketDataProvider.getCategories(),
  ]);

  return { events, categories };
}

export const meta: Route.MetaFunction = () => [
  { title: "Mercados | Mercado de Previsoes" },
  {
    name: "description",
    content:
      "Explore mercados de previsao sobre economia, politica e eventos relevantes e acompanhe odds em tempo real.",
  },
  { property: "og:title", content: "Mercados | Mercado de Previsoes" },
  {
    property: "og:description",
    content:
      "Explore mercados de previsao sobre economia, politica e eventos relevantes e acompanhe odds em tempo real.",
  },
];

export default function MarketsRoute() {
  const data = useLoaderData<typeof loader>();

  return <MarketsPage initialEvents={data.events} initialCategories={data.categories} />;
}
