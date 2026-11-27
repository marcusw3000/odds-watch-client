import { test, expect } from '@playwright/test';

test('ofertas sem atualização ficam desatualizadas e voltam ao vivo', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    class FakeSocket {
      static OPEN = 1;
      readyState = 1;
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { (window as any).__testSocket = this; setTimeout(() => { this.onopen?.(); (window as any).__socketOpened = true; }, 0); }
      send() {}
      close() { this.readyState = 3; this.onclose?.(); }
    }
    (window as any).WebSocket = FakeSocket;
  });
  await page.goto('/polymarket/market/99999999999999999997');
  await page.clock.runFor(100);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__socketOpened))).toBe(true);
  const emit = () => page.evaluate(() => (window as any).__testSocket.onmessage?.({ data: JSON.stringify({ event_type: 'price_change', asset_id: '777', best_bid: '0.4', best_ask: '0.41' }) }));
  await expect.poll(async () => { await emit(); await page.clock.runFor(100); return page.getByText('Ofertas recebidas às', { exact: false }).count(); }).toBeGreaterThan(0);
  await page.clock.runFor(71_000);
  await expect(page.getByText('Ofertas ao vivo sem atualização recente')).toBeVisible();
  await emit();
  await page.clock.runFor(100);
  await expect(page.getByText('Ofertas recebidas às', { exact: false })).toBeVisible();
  await page.evaluate(() => (window as any).__testSocket.close());
  await page.clock.runFor(100);
  await expect(page.getByText('Reconectando às ofertas')).toBeVisible();
  await page.clock.runFor(1_200);
  await expect.poll(async () => { await emit(); await page.clock.runFor(100); return page.getByText('Ofertas recebidas às', { exact: false }).count(); }).toBeGreaterThan(0);
});

test('card do catálogo distingue preço ausente de zero', async ({ page }) => {
  await page.goto('/polymarket?q=fixture-cotacao');
  const card = page.locator('article').filter({ hasText: 'Evento de cotação simulada' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('link', { name: /Ausente/ })).toContainText('—');
  await expect(card.getByRole('link', { name: /Zero/ })).toContainText('0%');
});

test('mercado apresenta cotação ausente sem confundi-la com zero', async ({ page }) => {
  await page.goto('/polymarket/market/99999999999999999999');
  await expect(page.getByRole('heading', { name: 'Mercado de cotação simulada' })).toBeVisible();
  const results = page.getByRole('region', { name: 'Resultados' });
  await expect(results).toContainText('Ausente');
  await expect(results).toContainText('—');
  await expect(results).toContainText('0%');
  await expect(page.getByRole('region', { name: 'Histórico de preços' })).toContainText('Histórico insuficiente');
  const trading = page.getByRole('region', { name: 'Painel de simula??o' });
  await expect(trading.getByRole('button', { name: 'Ausente —' })).toBeVisible();
  await expect(trading.getByRole('button', { name: 'Zero 0.0¢' })).toBeVisible();
});

test('portfólio autenticado não calcula total com cotação ausente', async ({ page }) => {
  const user = { id: '8bf77056-eaa6-471a-9bba-3e2ef09c3932', aud: 'authenticated', role: 'authenticated', email: 'paper@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, aud: 'authenticated', role: 'authenticated' })}.signature`;
  await page.route('**/*.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const reply = (body: unknown) => route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' } });
    if (path === '/auth/v1/token') return reply({ access_token: token, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user });
    if (path === '/auth/v1/user') return reply(user);
    if (path.endsWith('/rpc/has_role')) return reply(false);
    if (path.endsWith('/rpc/get_polymarket_paper_wallet')) return reply({ user_id: user.id, balance_usd: 10000, round_id: '4788abf8-4844-442a-9e03-6fcac9c0d129' });
    if (path.endsWith('/polymarket_paper_positions')) return reply([{ id: 'position-1', market_id: '99999999999999999999', market_question: 'Mercado sem cotação', outcome_label: 'Zero', outcome_token_id: null, shares: 10, average_price: 0.25 }]);
    if (path.endsWith('/rpc/get_my_paper_ranking_stats')) return reply([{ total_profit: 0, roi_percent: 0, total_volume: 0, total_trades: 0, winning_trades: 0 }]);
    return reply([]);
  });
  let quoteState: 'missing' | 'failure' | 'success' = 'missing';
  await page.route('**/api/polymarket/portfolio-quotes', route => quoteState === 'failure' ? route.fulfill({ status: 503, json: { error: 'unavailable' } }) : route.fulfill({ json: { markets: quoteState === 'success' ? [{ marketId: '99999999999999999999', quoteOrigin: 'persistent_cache', quoteObservedAt: '2026-11-03T00:00:00Z', outcomes: [{ label: 'Zero', tokenId: null, price: '0.5' }] }] : [] } }));
  await page.goto('/auth?returnTo=%2Fportfolio');
  await page.getByPlaceholder('seu@email.com').fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill('PaperTest123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio/);
  await expect(page.getByText('Algumas cotações estão indisponíveis', { exact: false })).toBeVisible();
  await expect(page.getByText('Mercado sem cotação')).toBeVisible();
  await expect(page.getByText('Valor atual das posições simuladas').locator('..')).toContainText('Indisponível');
  quoteState = 'failure';
  await page.reload();
  await expect(page.getByText('Cotações temporariamente indisponíveis', { exact: false })).toBeVisible({ timeout: 15000 });
  quoteState = 'success';
  await page.reload();
  await expect(page.getByText('Valor atual das posições simuladas').locator('..')).toContainText('US$');
  await expect(page.getByText('Cotações públicas consultadas em', { exact: false })).toBeVisible();
  await expect(page.getByText('Cache persistente (pode estar desatualizada)', { exact: false })).toBeVisible();
  await expect(page.getByText('Mercado sem cotação').locator('..').locator('..')).toContainText('50.0¢');
  await page.goto('/polymarket?q=fixture-cotacao');
  const card = page.locator('article').filter({ hasText: 'Evento de cotação simulada' });
  await expect(card.getByRole('link', { name: /Zero/ })).toContainText('0%');
  await expect(page.getByText('Os cards usam dados em cache', { exact: false })).toBeVisible();
});
