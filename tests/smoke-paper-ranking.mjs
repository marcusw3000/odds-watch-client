// Disposable smoke test for the explicitly configured project. No secrets are printed.
// Usage: node --env-file=.env.local tests/smoke-paper-ranking.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

const expectedProject = "tztqsorbugjhwljbiano";
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (url !== `https://${expectedProject}.supabase.co` || !serviceKey || !publishableKey) throw new Error("Configuração do projeto de teste não corresponde ao projeto esperado.");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `paper-smoke-${randomUUID()}@example.invalid`;
const password = randomBytes(24).toString("base64url");
let userId;
let failed = false;
const check = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  check(!created.error && created.data.user?.id, `Falha ao criar usuário temporário (${created.error?.code ?? "desconhecida"}).`);
  userId = created.data.user.id;
  const login = await client.auth.signInWithPassword({ email, password });
  check(!login.error && login.data.user?.id === userId, "Autenticação temporária falhou.");
  const profile = await client.from("profiles").update({ display_name: "Teste temporário paper", is_public: true, show_profit: true, show_roi: true, show_volume: true, show_trades: true }).eq("id", userId).select("id");
  check(!profile.error && profile.data?.length === 1, `Perfil temporário indisponível (${profile.error?.code ?? `linhas: ${profile.data?.length ?? 0}`}).`);
  const wallet = await client.rpc("get_polymarket_paper_wallet");
  check(!wallet.error && wallet.data?.round_id, "Carteira simulada indisponível.");
  const forbidden = await client.from("polymarket_paper_wallets").update({ balance_usd: 999999 }).eq("user_id", userId).select();
  check(Boolean(forbidden.error), "A gravação direta da carteira não foi bloqueada.");
  const oldRpc = await client.rpc("execute_polymarket_paper_trade", { p_market_id: "561229", p_market_question: "Teste", p_outcome_label: "Yes", p_outcome_token_id: "1", p_side: "BUY", p_price: 0.01, p_shares: 1 });
  check(Boolean(oldRpc.error), "A função antiga não foi bloqueada.");
  const requestId = randomUUID();
  const input = { marketId: "561229", outcome: "Yes", side: "BUY", shares: 10, requestId, roundId: wallet.data.round_id, limitPrice: 1 };
  const executed = await client.functions.invoke("execute-polymarket-paper-trade", { body: input });
  check(!executed.error && executed.data?.success === true, `Operação verificada falhou (${executed.error?.name ?? "resposta inválida"}).`);
  const retried = await client.functions.invoke("execute-polymarket-paper-trade", { body: input });
  check(!retried.error && retried.data?.success === true, "Repetição idempotente falhou.");
  const sale = await client.functions.invoke("execute-polymarket-paper-trade", { body: { ...input, side: "SELL", requestId: randomUUID(), limitPrice: 0.000001 } });
  check(!sale.error && sale.data?.success === true, "Venda verificada falhou.");
  const stats = await client.rpc("get_my_paper_ranking_stats");
  const expectedProfit = Number(sale.data.notional_usd) - Number(executed.data.notional_usd);
  check(!stats.error && stats.data?.[0]?.total_trades === 2 && Number(stats.data[0].total_volume) > 0 && Math.abs(Number(stats.data[0].total_profit) - expectedProfit) < 0.000001, "Estatísticas simuladas incorretas.");
  const leaderboard = await client.rpc("get_paper_leaderboard", { p_sort: "trades", p_limit: 100 });
  check(!leaderboard.error && leaderboard.data?.some((row) => row.user_id === userId && row.total_trades === 2), "Participante temporário não apareceu no ranking.");
  const hideProfit = await client.from("profiles").update({ show_profit: false }).eq("id", userId);
  check(!hideProfit.error, "Não foi possível atualizar a privacidade do perfil.");
  const hiddenProfit = await client.rpc("get_paper_leaderboard", { p_sort: "trades", p_limit: 100 });
  check(!hiddenProfit.error && hiddenProfit.data?.some((row) => row.user_id === userId && row.total_profit === null), "A privacidade do lucro não foi respeitada.");
  const forbiddenProfile = await client.from("profiles").update({ total_profit: 1234 }).eq("id", userId);
  check(Boolean(forbiddenProfile.error), "O campo financeiro do perfil está gravável.");
  const reset = await client.rpc("reset_polymarket_paper_wallet");
  check(!reset.error, "Reset da carteira simulada falhou.");
  const resetStats = await client.rpc("get_my_paper_ranking_stats");
  check(!resetStats.error && resetStats.data?.[0]?.total_trades === 0, "Reset da pontuação falhou.");
  const stale = await client.functions.invoke("execute-polymarket-paper-trade", { body: input });
  check(Boolean(stale.error), "Repetição de rodada anterior foi aceita.");
  process.stdout.write("Autenticação, compra, venda, lucro, idempotência, privacidade, permissões e reset remoto: OK.\n");
} catch (error) {
  failed = true;
  process.stderr.write(`${error instanceof Error ? error.message : "Falha no teste temporário."}\n`);
} finally {
  if (userId) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) { failed = true; process.stderr.write("Não foi possível remover o usuário temporário; revise o painel de autenticação.\n"); }
    else process.stdout.write("Usuário temporário removido.\n");
  }
  await client.auth.signOut().catch(() => {});
}
if (failed) process.exitCode = 1;
