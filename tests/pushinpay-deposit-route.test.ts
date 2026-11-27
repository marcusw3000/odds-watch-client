import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/server', () => ({
  getServerAuthState: vi.fn().mockResolvedValue({ user: { id: '20000000-0000-4000-8000-000000000001', app_metadata: {} }, headers: new Headers() }),
}));
vi.mock('@/services/PushinPayDepositStore.server', () => ({ createPersistedPushinPayDeposit: vi.fn(), getPersistedPushinPayDeposit: vi.fn() }));

import { action } from '../src/route-modules/pushinpay-deposit';
import { createPersistedPushinPayDeposit } from '@/services/PushinPayDepositStore.server';
import { getServerAuthState } from '@/integrations/supabase/server';

describe('rota de depósito PIX', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it('mantém a criação desativada por padrão', async () => {
    vi.stubEnv('PUSHINPAY_DEPOSITS_ENABLED', '');
    const request = new Request('https://example.test/api/pix/deposit', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: '{}' });
    const response = await action({ request } as never);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'unavailable' });
    expect(createPersistedPushinPayDeposit).not.toHaveBeenCalled();
  });
  it('continua exigindo sessão autenticada', async () => {
    vi.mocked(getServerAuthState).mockResolvedValueOnce({ user: null, headers: new Headers(), isAdmin: false, supabase: {} } as never);
    const request = new Request('https://example.test/api/pix/deposit', { method: 'POST', headers: { origin: 'https://example.test' } });
    expect((await action({ request } as never)).status).toBe(401);
    expect(createPersistedPushinPayDeposit).not.toHaveBeenCalled();
  });
  it('não permite que outro usuário use o modo de teste', async () => {
    vi.stubEnv('PUSHINPAY_DEPOSITS_ENABLED', '');
    vi.stubEnv('PUSHINPAY_DEPOSIT_TEST_USER_ID', '20000000-0000-4000-8000-000000000002');
    const request = new Request('https://example.test/api/pix/deposit', { method: 'POST', headers: { origin: 'https://example.test' } });
    expect((await action({ request } as never)).status).toBe(503);
    expect(createPersistedPushinPayDeposit).not.toHaveBeenCalled();
  });
  it('restringe o modo de teste ao valor de 50 centavos', async () => {
    vi.stubEnv('PUSHINPAY_DEPOSITS_ENABLED', '');
    vi.stubEnv('PUSHINPAY_DEPOSIT_TEST_USER_ID', '20000000-0000-4000-8000-000000000001');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('PUSHINPAY_API_TOKEN', 'test-token');
    vi.stubEnv('PUSHINPAY_WEBHOOK_URL', 'https://example.test/api/webhooks/pushinpay');
    vi.stubEnv('PUSHINPAY_WEBHOOK_SECRET', 'test-secret');
    vi.stubEnv('PUSHINPAY_RECONCILE_SECRET', 'test-secret');
    const request = new Request('https://example.test/api/pix/deposit', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify({ id: '10000000-0000-4000-8000-000000000001', valueCents: 100 }) });
    expect((await action({ request } as never)).status).toBe(422);
    expect(createPersistedPushinPayDeposit).not.toHaveBeenCalled();
  });
  it('permite que um usuário autenticado solicite depósito sem verificação de identidade', async () => {
    vi.stubEnv('PUSHINPAY_DEPOSITS_ENABLED', 'true');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('PUSHINPAY_API_TOKEN', 'test-token');
    vi.stubEnv('PUSHINPAY_WEBHOOK_URL', 'https://example.test/api/webhooks/pushinpay');
    vi.stubEnv('PUSHINPAY_WEBHOOK_SECRET', 'test-secret');
    vi.stubEnv('PUSHINPAY_RECONCILE_SECRET', 'test-secret');
    vi.mocked(createPersistedPushinPayDeposit).mockResolvedValue({ id: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001', valueCents: 1000, status: 'created', providerId: 'provider-id', pixCode: 'pix' });
    const request = new Request('https://example.test/api/pix/deposit', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify({ id: '10000000-0000-4000-8000-000000000001', valueCents: 1000 }) });
    const response = await action({ request } as never);
    expect(response.status).toBe(200);
    expect(createPersistedPushinPayDeposit).toHaveBeenCalledOnce();
  });
});
