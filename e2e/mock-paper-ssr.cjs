// Only the test JWT is mocked; other server requests use the normal implementation.
const originalFetch = globalThis.fetch;
const paperUser = { id: "8bf77056-eaa6-471a-9bba-3e2ef09c3932", aud: "authenticated", role: "authenticated", email: "paper@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const adminUser = { ...paperUser, id: '8bf77056-eaa6-471a-9bba-3e2ef09c3933', email: 'admin@example.test' };
globalThis.fetch = async (resource, init) => {
  const url = new URL(resource instanceof Request ? resource.url : String(resource));
  const headers = new Headers(init?.headers ?? (resource instanceof Request ? resource.headers : undefined));
  const token = headers.get("authorization") ?? "";
  if (url.hostname.endsWith(".supabase.co") && token.endsWith(".signature")) {
    let isAdmin = false;
    try { isAdmin = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub === adminUser.id; } catch { /* invalid token */ }
    if (url.pathname === "/auth/v1/user") return Response.json(isAdmin ? adminUser : paperUser);
    if (url.pathname.endsWith("/rpc/has_role")) return Response.json(isAdmin);
  }
  return originalFetch(resource, init);
};
