import { data } from "react-router";
import { ReferralPage } from "@/pages/ReferralPage";
import { requireAuthenticatedUser } from "@/integrations/supabase/server";
import type { Route } from "./+types/referral";

export async function loader({ request, url }: Route.LoaderArgs) {
  const auth = await requireAuthenticatedUser(request, url);

  return data(null, {
    headers: auth.headers,
  });
}

export default function ReferralRoute() {
  return <ReferralPage />;
}
