// Only the test JWT is mocked; other server requests use the normal implementation.
const originalFetch = globalThis.fetch;
const paperUser = { id: "8bf77056-eaa6-471a-9bba-3e2ef09c3932", aud: "authenticated", role: "authenticated", email: "paper@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const adminUser = { ...paperUser, id: '8bf77056-eaa6-471a-9bba-3e2ef09c3933', email: 'admin@example.test' };
globalThis.fetch = async (resource, init) => {
  const url = new URL(resource instanceof Request ? resource.url : String(resource));
  const headers = new Headers(init?.headers ?? (resource instanceof Request ? resource.headers : undefined));
  const token = headers.get("authorization") ?? "";
  if (url.hostname === 'gamma-api.polymarket.com' && url.pathname === '/markets/keyset' && url.searchParams.get('id') === '99999999999999999999') {
    return Response.json({ markets: [{ id: '99999999999999999999', question: 'Mercado de cotação simulada', outcomes: ['Ausente', 'Zero'], outcomePrices: [' ', '0'], acceptingOrders: true }] });
  }
  if (url.hostname === 'gamma-api.polymarket.com' && url.pathname === '/markets/keyset' && url.searchParams.get('id') === '99999999999999999997') {
    return Response.json({ markets: [{ id: '99999999999999999997', question: 'Mercado de fluxo simulado', outcomes: ['Yes', 'No'], outcomePrices: ['0.4', '0.6'], clobTokenIds: ['777', '778'], acceptingOrders: true }] });
  }
  if ((url.hostname === 'clob.polymarket.com' || url.hostname === 'data-api.polymarket.com') && url.searchParams.get('token_id') === '777') return Response.json({ bids: [], asks: [], data: [] });
  if (url.hostname.endsWith('.supabase.co') && url.pathname.endsWith('/polymarket_event_cache') && (url.searchParams.get('search_text') ?? '').includes('fixture-cotacao')) {
    return Response.json([{ event_id: '99999999999999999998', title: 'Evento de cotação simulada', image_url: null, volume_usd: 10, end_date: null, synced_at: new Date().toISOString(), polymarket_market_cache: [{ market_id: '99999999999999999999', event_id: '99999999999999999998', question: 'Mercado simulado', market_status: 'open', outcomes: [{ label: 'Ausente', price: ' ' }, { label: 'Zero', price: '0' }] }] }], { headers: { 'content-range': '0-0/1' } });
  }
  if (url.hostname.endsWith(".supabase.co") && token.endsWith(".signature")) {
    let isAdmin = false;
    try { isAdmin = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub === adminUser.id; } catch { /* invalid token */ }
    if (url.pathname === "/auth/v1/user") return Response.json(isAdmin ? adminUser : paperUser);
    if (url.pathname.endsWith("/rpc/has_role")) return Response.json(isAdmin);
  }
  return originalFetch(resource, init);
};
