import { data } from "react-router";
import { TraderDashboardPage } from "@/pages/TraderDashboardPage";
import { requireAuthenticatedUser } from "@/integrations/supabase/server";
import type { Route } from "./+types/trader-dashboard";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuthenticatedUser(request);

  return data(null, {
    headers: auth.headers,
  });
}

export default function TraderDashboardRoute() {
  return <TraderDashboardPage />;
}
