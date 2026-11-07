export interface PolymarketTag { label: string; value: string }
const cache = new Map<string, { expires: number; tags: PolymarketTag[] }>();

function parseTags(payload: unknown): PolymarketTag[] {
  if (!Array.isArray(payload)) throw new Error("Invalid Polymarket tags");
  const seen = new Set<string>();
  return payload.flatMap((value): PolymarketTag[] => {
    if (!value || typeof value !== "object") return [];
    const tag = value as Record<string, unknown>;
    if (tag.forceHide === true || typeof tag.label !== "string" || !tag.label.trim() || typeof tag.slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(tag.slug) || seen.has(tag.slug)) return [];
    seen.add(tag.slug);
    return [{ label: tag.label.trim().slice(0, 80), value: tag.slug }];
  }).slice(0, 100);
}

export async function getPolymarketTags(category = ""): Promise<PolymarketTag[]> {
  const slug = /^[a-z0-9-]{1,80}$/.test(category) ? category : "all";
  const cached = cache.get(slug);
  if (cached && cached.expires > Date.now()) return cached.tags;
  let tags: PolymarketTag[] = [];
  try {
    const url = new URL("https://polymarket.com/api/tags/filteredBySlug");
    url.searchParams.set("tag", slug);
    url.searchParams.set("status", "active");
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Tags unavailable (${response.status})`);
    tags = parseTags(await response.json());
  } catch {
    // Gamma's documented relationship API is a fallback when the site's list is unavailable.
    const url = slug === "all" ? "https://gamma-api.polymarket.com/tags?limit=100&order=id&ascending=false" : `https://gamma-api.polymarket.com/tags/slug/${encodeURIComponent(slug)}/related-tags/tags`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Tags unavailable (${response.status})`);
    tags = parseTags(await response.json());
  }
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(slug, { tags, expires: Date.now() + 5 * 60_000 });
  return tags;
}
