import { quotePaperBook, resolvePaperMarket } from "./paperQuote.ts";

type Args = { p_user: string; p_request: string; p_round: string; p_market: string; p_outcome: string; p_side: "BUY" | "SELL"; p_shares: number };
type Result = { data: unknown; error: { message?: string } | null };
export interface PaperHandlerDependencies {
  authenticate: (authorization: string) => Promise<string | null>;
  previous: (args: Args) => Promise<Result>;
  execute: (args: Args & { p_question: string; p_token: string; p_price: number }) => Promise<Result>;
  fetcher: typeof fetch;
  cors: Record<string, string>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPaperHandler(deps: PaperHandlerDependencies) {
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...deps.cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: deps.cors });
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Entre para simular." }, 401);
    let user: string | null;
    try { user = await deps.authenticate(authorization); } catch { return json({ error: "Sessão inválida." }, 401); }
    if (typeof user !== "string" || !uuid.test(user)) return json({ error: "Sessão inválida." }, 401);
    let input: Record<string, unknown>;
    try { input = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
    const { marketId, outcome, side, requestId, roundId, shares, limitPrice } = input ?? {};
    if (typeof marketId !== "string" || !/^\d{1,20}$/.test(marketId) || typeof outcome !== "string" || !outcome.trim() || outcome.length > 160 ||
      (side !== "BUY" && side !== "SELL") || typeof requestId !== "string" || !uuid.test(requestId) || typeof roundId !== "string" || !uuid.test(roundId) ||
      typeof shares !== "number" || !Number.isFinite(shares) || shares <= 0 || shares > 1_000_000 || Math.abs(shares * 1e6 - Math.round(shares * 1e6)) > 1e-5 ||
      typeof limitPrice !== "number" || !Number.isFinite(limitPrice) || limitPrice <= 0 || limitPrice > 1) return json({ error: "Dados inválidos para a simulação." }, 400);
    const common: Args = { p_user: user, p_request: requestId, p_round: roundId, p_market: marketId, p_outcome: outcome, p_side: side, p_shares: shares };
    let previous: Result;
    try { previous = await deps.previous(common); } catch { return json({ error: "Não foi possível verificar a operação. Tente novamente." }, 503); }
    if (previous.error) return json({ error: "Não foi possível verificar a operação. Atualize e tente novamente." }, 409);
    if (previous.data) return json(previous.data);
    try {
      const gamma = new URL("https://gamma-api.polymarket.com/markets/keyset");
      gamma.searchParams.set("id", marketId); gamma.searchParams.set("closed", "any"); gamma.searchParams.set("limit", "1");
      const response = await deps.fetcher(gamma, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Não foi possível consultar o mercado.");
      const market = resolvePaperMarket(await response.json(), marketId, outcome);
      const bookUrl = new URL("https://clob.polymarket.com/book"); bookUrl.searchParams.set("token_id", market.token);
      const bookResponse = await deps.fetcher(bookUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!bookResponse.ok) throw new Error("Livro de ofertas indisponível.");
      const price = quotePaperBook(await bookResponse.json(), market.token, shares, side);
      if ((side === "BUY" && price > limitPrice) || (side === "SELL" && price < limitPrice)) throw new Error("O preço mudou além do limite; atualize a cotação e tente novamente.");
      const result = await deps.execute({ ...common, p_question: market.question, p_token: market.token, p_price: price });
      if (result.error) return json({ error: result.error.message || "Não foi possível registrar a operação." }, 409);
      return json(result.data);
    } catch (error) {
      const message = error instanceof Error && error.name !== "AbortError" && error.name !== "TimeoutError" ? error.message : "Dados da Polymarket temporariamente indisponíveis.";
      return json({ error: message }, 503);
    }
  };
}
