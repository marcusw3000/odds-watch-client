import { data, redirect } from "react-router";
import { AuthPage } from "@/pages/AuthPage";
import {
  createRequestSupabaseClient,
  getServerAuthState,
} from "@/integrations/supabase/server";
import type { Route } from "./+types/auth";

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/markets";
  }

  return value;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const code = url.searchParams.get("code");

  if (code) {
    const { headers, supabase } = createRequestSupabaseClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[SSR Auth] OAuth code exchange failed:", error);
    }

    throw redirect(returnTo, {
      headers,
    });
  }

  const auth = await getServerAuthState(request);

  if (auth.user) {
    throw redirect(returnTo, {
      headers: auth.headers,
    });
  }

  return data(null, {
    headers: auth.headers,
  });
}

export default function AuthRoute() {
  return <AuthPage />;
}
