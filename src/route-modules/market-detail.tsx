import { useLoaderData } from "react-router";
import { MarketDetailPage } from "@/pages/MarketDetailPage";
import { MarketDataProvider } from "@/services/MarketDataProvider";
import type { Route } from "./+types/market-detail";

export async function loader({ params }: Route.LoaderArgs) {
  const marketId = params.id;

  if (!marketId) {
    return {
      event: null,
      oddsHistory: [],
      multiOptionHistory: [],
    };
  }

  const event = await MarketDataProvider.getEventById(marketId);

  if (!event) {
    return {
      event: null,
      oddsHistory: [],
      multiOptionHistory: [],
    };
  }

  const [oddsHistory, multiOptionHistory] = await Promise.all([
    MarketDataProvider.getOddsHistory(marketId),
    event.marketType === "MULTIPLE"
      ? MarketDataProvider.getMultiOptionHistory(marketId)
      : Promise.resolve([]),
  ]);

  return {
    event,
    oddsHistory,
    multiOptionHistory,
  };
}

export const meta: Route.MetaFunction = ({ data }) => {
  if (!data?.event) {
    return [
      { title: "Mercado nao encontrado | Mercado de Previsoes" },
      {
        name: "description",
        content: "O mercado solicitado nao foi encontrado.",
      },
    ];
  }

  const description =
    data.event.description ||
    `Acompanhe odds, volume e negocie contratos no mercado ${data.event.title}.`;

  return [
    { title: `${data.event.title} | Mercado de Previsoes` },
    { name: "description", content: description },
    { property: "og:title", content: data.event.title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    {
      property: "og:url",
      content: `https://mercadoprevisoes.com.br/market/${data.event.id}`,
    },
    {
      property: "og:image",
      content: data.event.imageUrl || "/og-image.png",
    },
    { name: "twitter:title", content: data.event.title },
    { name: "twitter:description", content: description },
    {
      name: "twitter:image",
      content: data.event.imageUrl || "/og-image.png",
    },
  ];
};

export default function MarketDetailRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <MarketDetailPage
      initialEvent={data.event}
      initialOddsHistory={data.oddsHistory}
      initialMultiOptionHistory={data.multiOptionHistory}
    />
  );
}
