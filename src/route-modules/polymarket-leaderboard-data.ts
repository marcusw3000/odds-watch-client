import { getPolymarketLeaderboard } from "@/services/PolymarketLeaderboard.server";
import type { Route } from "./+types/polymarket-leaderboard-data";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const page = await getPolymarketLeaderboard(new URL(request.url).searchParams);
    return Response.json(page, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch (error) {
    console.error("[Polymarket leaderboard]", error);
    return Response.json({ error: "Não foi possível carregar o ranking da Polymarket." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
