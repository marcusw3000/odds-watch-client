import { expect, test } from '@playwright/test';

test('admin uses simulated wallet and sees monitoring and legacy finance clearly', async ({ page }) => {
  const user = { id: '8bf77056-eaa6-471a-9bba-3e2ef09c3933', aud: 'authenticated', role: 'authenticated', email: 'admin@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, aud: 'authenticated', role: 'authenticated' })}.signature`;
  await page.route('**/*.supabase.co/**', async route => {
    const { pathname } = new URL(route.request().url());
    const reply = (body: unknown) => route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' } });
    if (pathname === '/auth/v1/token') return reply({ access_token: token, refresh_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user });
    if (pathname === '/auth/v1/user') return reply(user);
    if (pathname.endsWith('/rpc/has_role')) return reply(true);
    if (pathname.endsWith('/get-admin-users')) return reply({ users: [{ id: user.id, user_id: user.id, display_name: 'Conta teste', email: user.email, balance_available: 123.45, balance_locked: 0, currency: 'USD', roles: ['admin'], is_blocked: false, created_at: user.created_at, updated_at: user.created_at }], pagination: { total: 1, limit: 20, offset: 0, hasMore: false } });
    if (pathname.endsWith('/get-admin-user-details')) return reply({ profile: { id: user.id, display_name: 'Conta teste', email: user.email, is_public: true, is_blocked: false, created_at: user.created_at }, roles: ['admin'], paper: { wallet: { balance_usd: 123.45 }, positions: [{ id: 'p1', market_id: '42', market_question: 'Evento de teste', outcome_label: 'Yes', shares: 2.5, average_price: 0.3 }], trades: [] }, notifications: [], referralStats: { total: 0, activated: 0, pending: 0 }, auditLogs: [] });
    if (pathname.endsWith('/rpc/get_admin_catalog_health')) return reply({ market_count: 42, latest_sync: null, latest_closure_check: null, jobs: [{ name: 'sync-polymarket-catalog', active: false, schedule: '*/5 * * * *', last_status: null, last_run: null }] });
    return reply([]);
  });
  await page.goto('/auth?returnTo=%2Fpolymarket');
  await page.getByPlaceholder('seu@email.com').fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/polymarket/);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/users/);
  await expect(page.getByText('Saldo virtual (USD)')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Conta teste').first()).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'Conta teste' }).getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Ver Detalhes' }).click();
  await page.getByRole('tab', { name: 'Posições' }).click();
  await expect(page.getByText('Evento de teste')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/admin/system');
  await expect(page.getByText(/sync-polymarket-catalog · Pausado/)).toBeVisible();
  await page.goto('/admin/financial');
  await expect(page.getByText('Financeiro legado')).toBeVisible();
});
