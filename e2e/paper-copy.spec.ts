import { expect, test } from "@playwright/test";

test("configure a simulated copy and approve a manual signal", async ({ page }) => {
  const user = { id: "8bf77056-eaa6-471a-9bba-3e2ef09c3932", aud: "authenticated", role: "authenticated", email: "paper@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expiresAt = Math.floor(Date.now()/1000)+3600;
  const token = `${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:user.id,exp:expiresAt,aud:"authenticated",role:"authenticated"})}.signature`;
  const strategyId = "22222222-2222-4222-8222-222222222222", signalId = "33333333-3333-4333-8333-333333333333", address = "0x1234567890123456789012345678901234567890";
  let active = false, signalStatus = "pending";
  await page.route("**/*.supabase.co/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const reply = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" } });
    if (path === "/auth/v1/token") return reply({ access_token:token, refresh_token:"fake-refresh", token_type:"bearer", expires_in:3600, expires_at:expiresAt, user });
    if (path === "/auth/v1/user") return reply(user);
    if (path.endsWith("/rpc/has_role")) return reply(false);
    if (path.endsWith("/rpc/save_paper_copy_strategy")) { const body=route.request().postDataJSON(); expect(body).toMatchObject({ p_kind:"polymarket", p_source:address, p_mode:"manual", p_total:100, p_per_trade:10 }); active=true; return reply(strategyId); }
    if (path.endsWith("/rpc/respond_paper_copy_signal")) { expect(route.request().postDataJSON()).toMatchObject({p_signal:signalId,p_accept:true}); signalStatus="approved"; return reply(null); }
    if (path.endsWith("/paper_copy_strategies")) return reply(active ? [{id:strategyId,source_kind:"polymarket",source_id:address,source_name:"Trader Externo",mode:"manual",total_limit:100,per_trade_limit:10,spent_usd:0,round_id:"round",active:true,started_at:new Date().toISOString()}] : []);
    if (path.endsWith("/paper_copy_signals")) return reply(active ? [{id:signalId,strategy_id:strategyId,question:"Mercado de teste",outcome:"Yes",status:signalStatus,source_price:0.4,source_notional:10,reason:null,created_at:new Date().toISOString()}] : []);
    if (path.endsWith("/paper_copy_positions")) return reply([]);
    if (path.endsWith("/rpc/get_my_paper_ranking_stats")) return reply([{total_profit:0,roi_percent:0,total_volume:0,total_trades:0,winning_trades:0}]);
    if (path.endsWith("/profiles")) return reply({id:user.id,display_name:"Teste",is_public:true});
    return reply([]);
  });
  await page.route("**/api/polymarket/leaderboard?*", route => route.fulfill({ json: { entries: [{rank:1,address,name:"Trader Externo",image:null,pnl:20,volume:100}] } }));
  await page.goto("/auth?returnTo=%2Fleaderboard");
  await page.getByPlaceholder("seu@email.com").fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill("PaperTest123!");
  await page.getByRole("button", {name:"Entrar",exact:true}).click();
  await expect(page).toHaveURL(/leaderboard/);
  await page.getByRole("tab", {name:"Polymarket"}).click();
  await page.getByRole("link", {name:"Copiar Trader Externo"}).click();
  await expect(page.getByRole("heading", {name:"Copy Trading simulado"})).toBeVisible();
  await page.getByLabel("Limite total (USD virtual)").fill("100");
  await page.getByLabel("Limite por operação (USD virtual)").fill("10");
  await page.getByRole("button", {name:"Ativar estratégia"}).click();
  await expect(page.getByText("Aguardando aprovação")).toBeVisible();
  await page.getByRole("button", {name:"Aceitar cópia"}).click();
  await expect(page.getByText("Aguardando processamento")).toBeVisible();
});
