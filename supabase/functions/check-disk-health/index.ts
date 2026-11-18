import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("PAPER_COPY_CRON_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!secret || req.headers.get("x-copy-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });
  if (!url || !key) return new Response("Unavailable", { status: 503 });
  try {
    const response = await fetch(`${url}/customer/v1/privileged/metrics`, { headers: { Authorization: `Basic ${btoa(`service_role:${key}`)}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("metrics unavailable");
    const values = new Map<string, number>();
    for (const line of (await response.text()).split("\n")) {
      const m = /^(node_filesystem_(?:size|avail)_bytes)\{([^}]*)\}\s+([\d.eE+-]+)$/.exec(line.trim());
      if (m && /(?:^|,)mountpoint="\/data"(?:,|$)/.test(m[2]) && /(?:^|,)service_type="db"(?:,|$)/.test(m[2])) values.set(m[1], Number(m[3]));
    }
    const size = values.get("node_filesystem_size_bytes"), available = values.get("node_filesystem_avail_bytes");
    if (size == null || available == null || !Number.isFinite(size) || !Number.isFinite(available) || size <= 0 || available < 0 || available > size) throw new Error("invalid metrics");
    const client = createClient(url, key, { auth: { persistSession: false } });
    const result = await client.rpc("record_disk_health", { p_percent: (1 - available / size) * 100 });
    if (result.error) throw result.error;
    return Response.json({ success: true });
  } catch { return Response.json({ error: "disk monitoring unavailable" }, { status: 503 }); }
});
