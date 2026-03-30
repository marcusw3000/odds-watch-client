import { data } from "react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { requireAdminUser } from "@/integrations/supabase/server";
import type { Route } from "./+types/admin-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAdminUser(request);

  return data(null, {
    headers: auth.headers,
  });
}

export default AdminLayout;
