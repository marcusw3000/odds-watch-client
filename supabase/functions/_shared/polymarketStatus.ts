const GAMMA_API_URL = "https://gamma-api.polymarket.com";

/** A missing upstream row is inconclusive and is never treated as closed. */
export async function fetchConfirmedStatuses(kind: "markets" | "events", ids: string[], timeoutMs: number, request = fetch) {
  const url = new URL(`/${kind}`, GAMMA_API_URL);
  for (const id of ids) url.searchParams.append("id", id);
  url.searchParams.set("limit", String(ids.length));
  // Gamma defaults to an open-only query; "any" is required to find closures.
  url.searchParams.set("closed", "any");
  const response = await request(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Gamma ${kind} reconciliation request failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error(`Gamma returned invalid ${kind} reconciliation data`);
  const requested = new Set(ids);
  return payload.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const row = value as { id?: unknown; closed?: unknown; acceptingOrders?: unknown };
    const id = typeof row.id === "string" ? row.id : typeof row.id === "number" ? String(row.id) : null;
    if (!id || !requested.has(id) || typeof row.closed !== "boolean") return [];
    return [{ id, closed: row.closed, acceptingOrders: typeof row.acceptingOrders === "boolean" ? row.acceptingOrders : null }];
  });
}
