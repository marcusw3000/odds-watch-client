export const LEADERBOARD_PERIODS = ["day", "week", "month", "all"] as const;
export const LEADERBOARD_CATEGORIES = ["overall", "politics", "sports", "crypto", "culture", "economics", "tech", "finance", "esports"] as const;
export type ExternalLeaderboardEntry = { rank: number; address: string; name: string; image: string | null; pnl: number; volume: number };

export async function getPolymarketLeaderboard(params: URLSearchParams): Promise<{ entries: ExternalLeaderboardEntry[]; nextCursor: string | null }> {
  const period = params.get("period") ?? "month";
  const category = params.get("category") ?? "overall";
  const order = params.get("order") ?? "PNL";
  const cursor = params.get("cursor");
  if (!(LEADERBOARD_PERIODS as readonly string[]).includes(period) || !(LEADERBOARD_CATEGORIES as readonly string[]).includes(category) || !["PNL", "VOLUME"].includes(order)) throw new Error("Filtros inválidos");
  if (cursor && (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor))) throw new Error("Cursor inválido");
  const url = new URL("https://data-api.polymarket.com/v2/leaderboard");
  url.search = new URLSearchParams({ time_period: period, category, sort_by: order, limit: "50" }).toString();
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Polymarket indisponível (${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) throw new Error("Resposta inválida da Polymarket");
  const entries = (payload as { data: Record<string, unknown>[] }).data.flatMap((row) => {
    if (!row || typeof row !== "object" || typeof row.user_id !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(row.user_id) || typeof row.rank !== "number" || !Number.isFinite(row.rank) || typeof row.pnl !== "number" || !Number.isFinite(row.pnl) || typeof row.volume !== "number" || !Number.isFinite(row.volume)) return [];
    const image = typeof row.profile_image === "string" && /^https:\/\//i.test(row.profile_image) ? row.profile_image : null;
    return [{ rank: row.rank, address: row.user_id, name: typeof row.user_name === "string" && row.user_name.trim() ? row.user_name.trim().slice(0, 100) : `${row.user_id.slice(0, 6)}…${row.user_id.slice(-4)}`, image, pnl: row.pnl, volume: row.volume }];
  });
  const pagination = (payload as { pagination?: { next_cursor?: unknown } }).pagination;
  return { entries, nextCursor: typeof pagination?.next_cursor === "string" && pagination.next_cursor.length <= 2048 && /^[A-Za-z0-9_-]+$/.test(pagination.next_cursor) ? pagination.next_cursor : null };
}

export type BiggestWin = { rank: number; address: string; name: string; title: string; initial: number; final: number; pnl: number; kind: string; eventId: string | null };
export async function getPolymarketBiggestWins(params: URLSearchParams): Promise<BiggestWin[]> {
  const period = params.get("period") ?? "month", category = params.get("category") ?? "overall";
  if (!(LEADERBOARD_PERIODS as readonly string[]).includes(period) || !(LEADERBOARD_CATEGORIES as readonly string[]).includes(category)) throw new Error("Filtros inválidos");
  const url = new URL("https://data-api.polymarket.com/v2/biggest-winners");
  url.search = new URLSearchParams({ time_period: period, category, limit: "10" }).toString();
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Maiores ganhos indisponíveis");
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw new Error("Resposta inválida da Polymarket");
  return payload.data.flatMap((row: Record<string, unknown>) => {
    if (typeof row.user_id !== "string" || !/^0x[0-9a-f]{40}$/i.test(row.user_id) || typeof row.pnl !== "number" || !Number.isFinite(row.pnl) || typeof row.initial_value !== "number" || !Number.isFinite(row.initial_value) || typeof row.final_value !== "number" || !Number.isFinite(row.final_value) || typeof row.win_rank !== "number") return [];
    return [{ rank: row.win_rank, address: row.user_id, name: typeof row.user_name === "string" && row.user_name.trim() ? row.user_name.trim().slice(0,100) : `${row.user_id.slice(0,6)}…${row.user_id.slice(-4)}`, title: typeof row.event_title === "string" ? row.event_title.slice(0,300) : "Mercado", initial: row.initial_value, final: row.final_value, pnl: row.pnl, kind: String(row.kind ?? ""), eventId: row.kind === "market" && Number.isSafeInteger(Number(row.event_id)) && Number(row.event_id) > 0 ? String(row.event_id) : null }];
  });
}
