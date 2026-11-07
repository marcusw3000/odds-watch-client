export interface PolymarketPublicComment {
  id: string;
  author: string;
  body: string;
  createdAt: string | null;
}

const cache = new Map<string, { expires: number; comments: PolymarketPublicComment[] }>();

export async function getPolymarketEventComments(eventId: string): Promise<PolymarketPublicComment[]> {
  if (!/^\d{1,20}$/.test(eventId)) return [];
  const current = cache.get(eventId);
  if (current && current.expires > Date.now()) return current.comments;
  const url = new URL("https://gamma-api.polymarket.com/comments");
  url.searchParams.set("parent_entity_type", "Event");
  url.searchParams.set("parent_entity_id", eventId);
  url.searchParams.set("limit", "30");
  url.searchParams.set("order", "createdAt");
  url.searchParams.set("ascending", "false");
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Polymarket comments unavailable (${response.status})`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid Polymarket comments response");
  const comments = data.flatMap((item): PolymarketPublicComment[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.body !== "string" || !row.body.trim() || (typeof row.id !== "string" && typeof row.id !== "number")) return [];
    const profile = row.profile && typeof row.profile === "object" ? row.profile as Record<string, unknown> : {};
    const name = profile.displayUsernamePublic === true && typeof profile.name === "string" ? profile.name : profile.pseudonym;
    return [{ id: String(row.id), body: row.body.slice(0, 5000), author: typeof name === "string" && name.trim() ? name.slice(0, 80) : "Usuário Polymarket", createdAt: typeof row.createdAt === "string" && Number.isFinite(Date.parse(row.createdAt)) ? row.createdAt : null }];
  });
  cache.set(eventId, { comments, expires: Date.now() + 30_000 });
  return comments;
}
