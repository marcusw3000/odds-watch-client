import { fetchConfirmedStatuses } from "./polymarketStatus.ts";

interface Dependencies {
  secret: string;
  candidates: () => Promise<{ data: { market_id: string }[] | null; error: unknown }>;
  record: (attempted: string[], closed: string[]) => Promise<{ data: number | null; error: unknown }>;
  fetcher: typeof fetch;
}

export function createClosureHandler(deps: Dependencies) {
  return async (request: Request) => {
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
    if (!deps.secret || request.headers.get("Authorization") !== `Bearer ${deps.secret}`) return json({ error: "Não autorizado." }, 401);
    try {
      const result = await deps.candidates();
      if (result.error) throw new Error("Falha ao consultar mercados monitorados.");
      const ids = (result.data ?? []).map(row => row.market_id).filter(id => /^\d{1,20}$/.test(id));
      if (!ids.length) return json({ checked: 0, confirmed: 0, notifications: 0 });
      const statuses = await fetchConfirmedStatuses("markets", ids, 10000, deps.fetcher);
      const saved = await deps.record(ids, statuses.filter(status => status.closed).map(status => status.id));
      if (saved.error) throw new Error("Falha ao registrar notificações.");
      return json({ checked: ids.length, confirmed: statuses.length, notifications: saved.data ?? 0 });
    } catch (error) {
      console.error("[check-polymarket-closures]", error instanceof Error ? error.message : "Falha desconhecida");
      return json({ error: "Não foi possível verificar encerramentos." }, 503);
    }
  };
}
