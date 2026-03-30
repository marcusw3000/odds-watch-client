import { data, redirect } from "react-router";
import ProfilePage from "@/pages/ProfilePage";
import { getServerAuthState } from "@/integrations/supabase/server";
import type { Route } from "./+types/profile";

export async function loader({ params, request }: Route.LoaderArgs) {
  const auth = await getServerAuthState(request);

  if (!params.userId && !auth.user) {
    const url = new URL(request.url);
    const returnTo = `${url.pathname}${url.search}`;

    throw redirect(`/auth?returnTo=${encodeURIComponent(returnTo)}`, {
      headers: auth.headers,
    });
  }

  return data(null, {
    headers: auth.headers,
  });
}

export default function ProfileRoute() {
  return <ProfilePage />;
}
