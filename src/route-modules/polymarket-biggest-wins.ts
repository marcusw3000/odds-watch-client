import { getPolymarketBiggestWins } from "@/services/PolymarketLeaderboard.server";
import type { Route } from "./+types/polymarket-biggest-wins";
export async function loader({ request }: Route.LoaderArgs) {
  try { return Response.json({ wins: await getPolymarketBiggestWins(new URL(request.url).searchParams) }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } }); }
  catch { return Response.json({ error: "Maiores ganhos indisponíveis" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
