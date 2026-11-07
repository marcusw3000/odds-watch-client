import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createPaperHandler } from "../_shared/paperHandler.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return new Response(JSON.stringify({ error: "Serviço indisponível." }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return createPaperHandler({
    cors,
    fetcher: fetch,
    authenticate: async (authorization) => {
      const client = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
      const { data, error } = await client.auth.getClaims(authorization.slice(7));
      return !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    },
    previous: async (args) => { const { data, error } = await admin.rpc("get_verified_paper_request", args); return { data, error }; },
    execute: async (args) => { const { data, error } = await admin.rpc("execute_verified_paper_trade", args); return { data, error }; },
  })(req);
});
