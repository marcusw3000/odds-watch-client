const addressPattern = /^0x[0-9a-f]{40}$/i;
const intervals = ["1d", "1w", "1m", "all"] as const;
async function getJson(url: URL): Promise<any> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Dados públicos indisponíveis (${response.status})`);
  return response.json();
}
export async function getPolymarketTrader(address: string, interval: string) {
  if (!addressPattern.test(address) || !(intervals as readonly string[]).includes(interval)) throw new Error("Perfil inválido");
  const make = (base: string, path: string, params: Record<string,string>) => { const url = new URL(path, base); url.search = new URLSearchParams(params).toString(); return url; };
  const endpoints = [make("https://gamma-api.polymarket.com", "/public-profile", { address }), make("https://data-api.polymarket.com", "/v2/user-stats", { user: address }), make("https://data-api.polymarket.com", "/v2/value", { user: address }), make("https://data-api.polymarket.com", "/v2/user-pnl", { user: address, interval, fidelity: interval === "all" ? "1d" : "1h" }), make("https://data-api.polymarket.com", "/v2/positions", { user: address, status: "OPEN", limit: "30" })];
  const results = await Promise.allSettled(endpoints.map(getJson));
  const val = (i: number) => results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<any>).value : null;
  const profile = val(0), stats = val(1)?.data, value = val(2)?.data, pnl = val(3)?.data, positions = val(4)?.data;
  if (!profile && !stats && !value && !pnl && !positions) throw new Error("Perfil indisponível");
  const number = (n: unknown): number | null => typeof n === "number" && Number.isFinite(n) ? n : null;
  return { address, name: typeof profile?.name === "string" && profile.name.trim() ? profile.name.slice(0, 100) : `${address.slice(0,6)}…${address.slice(-4)}`, bio: typeof profile?.bio === "string" ? profile.bio.slice(0, 500) : "", image: typeof profile?.profileImage === "string" && /^https:\/\//i.test(profile.profileImage) ? profile.profileImage : null,
    portfolioValue: number(value?.value), biggestWin: number(stats?.biggest_win), marketsTraded: number(stats?.trades), allTimePnl: number(stats?.all_time_pnl?.position_pnl), volumeUsd: number(stats?.all_time_pnl?.volume_usdc),
    points: Array.isArray(pnl?.points) ? pnl.points.flatMap((p: any) => number(p?.timestamp) !== null && number(p?.position_pnl) !== null ? [{ time: p.timestamp * 1000, value: p.position_pnl }] : []).slice(-800) : null,
    positions: Array.isArray(positions) ? positions.flatMap((p: any) => typeof p?.title === "string" && typeof p?.outcome === "string" ? [{ title: p.title.slice(0,300), outcome: p.outcome.slice(0,100), shares: number(p.current_size), average: number(p.avg_price), current: number(p.current_price), value: number(p.current_value), pnl: number(p.unrealized_pnl), token: String(p.token_id ?? "") }] : []) : null };
}
