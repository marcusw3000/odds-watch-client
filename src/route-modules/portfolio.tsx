import { data } from "react-router";
import { PortfolioPage } from "@/pages/PortfolioPage";
import { requireAuthenticatedUser } from "@/integrations/supabase/server";
import type { Route } from "./+types/portfolio";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuthenticatedUser(request);

  return data(null, {
    headers: auth.headers,
  });
}

export default function PortfolioRoute() {
  return <PortfolioPage />;
}
