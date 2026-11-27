import { expect, test } from '@playwright/test';

test('apresenta a cobrança, consulta e solicita saque', async ({ page }) => {
  const user = { id: '8bf77056-eaa6-471a-9bba-3e2ef09c3932', aud: 'authenticated', role: 'authenticated', email: 'paper@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, aud: 'authenticated', role: 'authenticated' })}.signature`;
  await page.route('**/*.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const reply = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' } });
    if (path === '/auth/v1/token') return reply({ access_token: token, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user });
    if (path === '/auth/v1/user') return reply(user);
    if (path.endsWith('/rpc/has_role')) return reply(false);
    if (path.endsWith('/profiles')) return reply({ id: user.id, display_name: 'Teste', is_public: true });
    return reply([]);
  });
  let createdId = '';
  await page.route('**/api/pix/balance', route => route.fulfill({ json: { availableCents: 5000, reservedCents: 0 } }));
  await page.route('**/api/pix/deposit**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/recheck')) return route.fulfill({ status: 202, json: { queued: true } });
    if (route.request().method() === 'POST') createdId = route.request().postDataJSON().id;
    else if (!new URL(route.request().url()).searchParams.has('id')) return route.fulfill({ json: { operations: [] } });
    else expect(new URL(route.request().url()).searchParams.get('id')).toBe(createdId);
    return route.fulfill({ json: { id: createdId, valueCents: 1234, status: 'created', pixCode: 'pix-teste' } });
  });
  await page.goto('/auth?returnTo=%2Fpolymarket');
  await page.getByPlaceholder('seu@email.com').fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill('PaperTest123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/polymarket/);
  await expect(page.getByRole('heading', { name: 'Brasil', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Depositar / Sacar' }).first().click();
  await page.getByLabel('Valor do depósito em reais').fill('12,34');
  await page.getByRole('button', { name: 'Gerar PIX' }).click();
  await expect(page.getByLabel('PIX copia e cola')).toHaveValue('pix-teste');
  await page.getByRole('button', { name: 'Consultar status' }).click();
  await expect(page.getByText('Aguardando pagamento.')).toBeVisible();
  await page.route('**/api/pix/withdrawal', async route => {
    const payload = route.request().postDataJSON();
    expect(payload.valueCents).toBe(1000);
    return route.fulfill({ json: { id: payload.id, valueCents: 1000, status: 'created' } });
  });
  await page.getByRole('button', { name: 'Sacar', exact: true }).click();
  await page.getByLabel('Valor do saque em reais').fill('10,00');
  await page.getByLabel('CPF ou CNPJ do destinatário').fill('12345678909');
  await page.getByLabel('Chave PIX', { exact: true }).fill('12345678909');
  await page.getByRole('button', { name: 'Solicitar saque' }).click();
  await expect(page.getByText('Solicitação registrada. Acompanhe o status nas movimentações recentes.')).toBeVisible();
});
