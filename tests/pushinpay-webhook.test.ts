import { describe, expect, it, vi } from 'vitest';
import { enqueuePushinPayWebhook, processPushinPayWebhook, type PushinPayWebhookDependencies } from '../src/services/PushinPayWebhook.server';

const operation = { id: 'local-id', providerId: 'ABC-123', amountCents: 1000, direction: 'deposit' as const };
function dependencies(): PushinPayWebhookDependencies {
  return {
    secret: 'test-secret',
    findOperation: vi.fn().mockResolvedValue(operation),
    claimVerification: vi.fn().mockResolvedValue(true),
    fetchTransaction: vi.fn().mockResolvedValue({ id: 'abc-123', valueCents: 1000, status: 'paid' }),
    recordVerifiedStatus: vi.fn().mockResolvedValue(undefined),
  };
}
function notification(body: string, secret = 'test-secret') {
  return new Request('https://example.test/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-pushinpay-token': secret }, body });
}

describe('notificação Pushin Pay', () => {
  it('confirma apenas após a gravação durável e rejeita autenticação inválida', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    expect((await enqueuePushinPayWebhook(notification('{"id":"ABC-123"}'), 'test-secret', enqueue)).status).toBe(200);
    expect(enqueue).toHaveBeenCalledWith('ABC-123');
    enqueue.mockRejectedValueOnce(new Error('database offline'));
    expect((await enqueuePushinPayWebhook(notification('{"id":"ABC-123"}'), 'test-secret', enqueue)).status).toBe(503);
    expect((await enqueuePushinPayWebhook(notification('{"id":"ABC-123"}', 'wrong'), 'test-secret', enqueue)).status).toBe(401);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });
  it('confere a resposta do provedor antes de registrar o status', async () => {
    const deps = dependencies();
    const response = await processPushinPayWebhook(notification('{"id":"ABC-123","status":"canceled","value":1}'), deps);
    expect(response.status).toBe(200);
    expect(deps.recordVerifiedStatus).toHaveBeenCalledWith(operation, 'paid');
  });

  it('rejeita segredo incorreto e corpos inválidos antes da consulta', async () => {
    const deps = dependencies();
    expect((await processPushinPayWebhook(notification('{"id":"ABC-123"}', 'wrong'), deps)).status).toBe(401);
    expect((await processPushinPayWebhook(notification('{"id":"../outro"}'), deps)).status).toBe(400);
    expect((await processPushinPayWebhook(notification(' '.repeat(8193)), deps)).status).toBe(400);
    expect(deps.findOperation).not.toHaveBeenCalled();
  });

  it('solicita nova tentativa quando a operação não está vinculada ou a consulta está limitada', async () => {
    const deps = dependencies();
    vi.mocked(deps.findOperation).mockResolvedValueOnce(null);
    expect((await processPushinPayWebhook(notification('{"id":"ABC-123"}'), deps)).status).toBe(503);
    vi.mocked(deps.claimVerification).mockResolvedValueOnce(false);
    const limited = await processPushinPayWebhook(notification('{"id":"ABC-123"}'), deps);
    expect(limited.status).toBe(503);
    expect(limited.headers.get('retry-after')).toBe('60');
    expect(deps.fetchTransaction).not.toHaveBeenCalled();
  });

  it('não registra resultado divergente ou falha de consulta', async () => {
    const deps = dependencies();
    vi.mocked(deps.fetchTransaction).mockResolvedValueOnce({ id: 'ABC-123', valueCents: 1, status: 'paid' });
    expect((await processPushinPayWebhook(notification('{"id":"ABC-123"}'), deps)).status).toBe(503);
    vi.mocked(deps.fetchTransaction).mockRejectedValueOnce(new Error('offline'));
    expect((await processPushinPayWebhook(notification('{"id":"ABC-123"}'), deps)).status).toBe(503);
    expect(deps.recordVerifiedStatus).not.toHaveBeenCalled();
  });
});
