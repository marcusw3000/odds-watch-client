import { data, redirect } from "react-router";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { getServerAuthState } from "@/integrations/supabase/server";
import type { Route } from "./+types/admin-login";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await getServerAuthState(request);

  if (auth.user && auth.isAdmin) {
    throw redirect("/admin", {
      headers: auth.headers,
    });
  }

  return data(null, {
    headers: auth.headers,
  });
}

export default AdminLoginPage;
