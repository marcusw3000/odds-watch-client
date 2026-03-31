/**
 * Shared CORS headers for Edge Functions.
 * Set the ALLOWED_ORIGIN environment variable to restrict origins in production.
 * Defaults to "*" if not set.
 */
export function getCorsHeaders(): Record<string, string> {
  const origin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}
