import { data } from "react-router";
import { SettingsPage } from "@/pages/SettingsPage";
import { requireAuthenticatedUser } from "@/integrations/supabase/server";
import type { Route } from "./+types/settings";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAuthenticatedUser(request);

  return data(null, {
    headers: auth.headers,
  });
}

export default function SettingsRoute() {
  return <SettingsPage />;
}
