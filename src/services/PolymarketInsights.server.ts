export interface MarketInsights {
  openInterest: number | null;
  resolution: string | null;
  holders: { name: string; amount: number; tokenId: string }[] | null;
}

const publicDataCache = new Map<string, { expires: number; promise: Promise<unknown> }>();

async function dataApi(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://data-api.polymarket.com/v2/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const key = url.toString();
  const cached = publicDataCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = (async () => {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Polymarket ${path} unavailable (${response.status})`);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("data" in data)) throw new Error(`Invalid ${path} response`);
    return data.data;
  })();
  const entry = { promise, expires: Date.now() + 15_000 };
  if (publicDataCache.size >= 256) publicDataCache.delete(publicDataCache.keys().next().value!);
  publicDataCache.set(key, entry);
  try { return await promise; } catch (error) { if (publicDataCache.get(key) === entry) publicDataCache.delete(key); throw error; }
}

export async function getMarketInsights(condition: string | null): Promise<MarketInsights> {
  if (!condition || !/^0x[0-9a-f]{64}$/i.test(condition)) return { openInterest: null, resolution: null, holders: null };
  const [oi, resolution, holders] = await Promise.allSettled([
    dataApi("oi", { condition }), dataApi("resolutions", { condition }), dataApi("holders", { condition, limit: "5" }),
  ]);
  const matching = (value: unknown) => Array.isArray(value) ? value.find((item) => item && typeof item === "object" && String(item.condition_id).toLowerCase() === condition.toLowerCase()) : null;
  const oiRow = oi.status === "fulfilled" ? matching(oi.value) : null;
  const resolutionRow = resolution.status === "fulfilled" ? matching(resolution.value) : null;
  const value = oiRow && typeof oiRow.value === "number" && Number.isFinite(oiRow.value) ? oiRow.value : null;
  const status = resolutionRow && typeof resolutionRow.status === "string" ? resolutionRow.status : null;
  const list = holders.status === "fulfilled" && Array.isArray(holders.value) ? holders.value.flatMap((group) => {
    if (!group || typeof group !== "object" || !Array.isArray(group.holders)) return [];
    return group.holders.flatMap((holder: unknown) => {
      if (!holder || typeof holder !== "object") return [];
      const h = holder as Record<string, unknown>;
      const amount = Number(h.amount);
      if (!Number.isFinite(amount) || amount < 0) return [];
      const name = h.display_username_public === true && typeof h.name === "string" ? h.name : h.pseudonym;
      return [{ name: typeof name === "string" && name ? name.slice(0, 80) : "Usuário Polymarket", amount, tokenId: typeof group.token_id === "string" ? group.token_id : "" }];
    });
  }).slice(0, 10) : null;
  return { openInterest: value, resolution: status, holders: list };
}

export async function getEventLiveVolume(eventId: string): Promise<number | null> {
  if (!/^\d{1,20}$/.test(eventId)) return null;
  const result = await dataApi("live-volume", { event_id: eventId });
  if (!result || typeof result !== "object" || !("taker_volume_total" in result)) return null;
  const value = result.taker_volume_total;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
