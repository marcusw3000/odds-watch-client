import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createClosureHandler } from "../_shared/closureHandler.ts";

Deno.serve(async (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("POLYMARKET_CRON_SECRET") ?? key;
  if (!url || !key || !secret) return Response.json({ error: "Serviço indisponível." }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  return createClosureHandler({
    secret,
    candidates: async () => await db.rpc("polymarket_closure_candidates", { p_limit: 100 }),
    record: async (attempted, closed) => await db.rpc("polymarket_record_closure_checks", { p_attempted: attempted, p_closed: closed }),
    fetcher: fetch,
  })(request);
});
