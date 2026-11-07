import { PolymarketPaperPortfolioPage } from "@/pages/PolymarketPaperPortfolioPage";
import { requireAuthenticatedUser } from "@/integrations/supabase/server";
import type { Route } from "./+types/portfolio";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuthenticatedUser(request);

  return null;
}

export default function PortfolioRoute() {
  return <PolymarketPaperPortfolioPage />;
}
