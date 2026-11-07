import { expect, test } from '@playwright/test';

test('invite is linked and the recreational dashboard shows verified participation', async ({ page }) => {
  const user = { id: '8bf77056-eaa6-471a-9bba-3e2ef09c3932', aud: 'authenticated', role: 'authenticated', email: 'paper@example.test', app_metadata: {}, user_metadata: { paper_referral_code: 'ABCDEF123456' }, created_at: new Date().toISOString() };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, aud: 'authenticated', role: 'authenticated' })}.signature`;
  let applied = 0;
  await page.route('**/*.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const reply = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' } });
    if (path === '/auth/v1/token') return reply({ access_token: token, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user });
    if (path === '/auth/v1/user') return reply(user);
    if (path.endsWith('/rpc/has_role')) return reply(false);
    if (path.endsWith('/rpc/apply_paper_referral')) { expect(route.request().postDataJSON()).toEqual({ p_code: 'ABCDEF123456' }); applied++; return reply('applied'); }
    if (path.endsWith('/rpc/get_my_paper_referral_code')) return reply('F123456789AB');
    if (path.endsWith('/rpc/get_my_paper_referral_stats')) return reply([{ total_referred: 2, active_referred: 1, verified_trades: 3 }]);
    if (path.endsWith('/rpc/get_polymarket_paper_wallet')) return reply({ user_id: user.id, balance_usd: 10000, round_id: '4788abf8-4844-442a-9e03-6fcac9c0d129' });
    if (path.endsWith('/profiles')) return reply({ id: user.id, display_name: 'Teste Paper', is_public: true, show_profit: true, show_roi: true, show_volume: true, show_trades: true });
    return reply([]);
  });
  await page.goto('/auth?returnTo=%2Freferral');
  // The account's own signup metadata wins over a stale code left by another account.
  await page.evaluate(() => localStorage.setItem('pendingReferralCode', '000000000000'));
  await page.getByPlaceholder('seu@email.com').fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill('PaperTest123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/referral/);
  await expect(page.getByRole('heading', { name: 'Convites para o simulador' })).toBeVisible();
  await expect(page.getByText('F123456789AB')).toBeVisible();
  await expect(page.getByText('Pessoas convidadas').locator('..').locator('..')).toContainText('2');
  await expect(page.getByText('Participantes ativos').locator('..').locator('..')).toContainText('1');
  await expect(page.getByText(/não oferecem desconto, comissão ou dinheiro/i)).toBeVisible();
  await expect.poll(() => applied).toBe(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pendingReferralCode'))).toBeNull();
});

test('email signup preserves the invitation in account metadata', async ({ page }) => {
  let signupCode: unknown;
  await page.route('**/*.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    if (path === '/auth/v1/signup') {
      signupCode = route.request().postDataJSON()?.data?.paper_referral_code;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: '8bf77056-eaa6-471a-9bba-3e2ef09c3932', aud: 'authenticated', role: 'authenticated', email: 'new@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  });
  await page.goto('/auth?ref=abcdef123456');
  await expect(page.getByText(/A indicação não oferece comissão ou desconto/)).toBeVisible();
  await page.getByPlaceholder('Seu nome completo').fill('Pessoa Teste');
  await page.getByPlaceholder('seu@email.com').fill('new@example.test');
  await page.getByPlaceholder('000.000.000-00').fill('52998224725');
  await page.getByPlaceholder('(11) 99999-9999').fill('11998765432');
  await page.locator('input[autocomplete="new-password"]').fill('PaperTest123!');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /criar conta/i }).click();
  await expect.poll(() => signupCode).toBe('ABCDEF123456');
  await expect(page.getByText(/Conta criada!/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pendingReferralCode'))).toBe('abcdef123456');
});
