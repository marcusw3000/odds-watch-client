import { describe, expect, it, vi } from 'vitest';
import { processNextPushinPayNotification, reconcilePushinPayNotification } from '../src/services/PushinPayReconcile.server';

const item = { operation_id: 'op', user_id: 'user', provider_id: 'abc', amount_cents: 1000, direction: 'deposit', revision: 1 };
const request = (token = 'secret') => new Request('https://example.test/internal', { headers: { authorization: `Bearer ${token}` } });
function deps() {
  return {
    claim: vi.fn().mockResolvedValue(item),
    consult: vi.fn().mockResolvedValue({ id: 'abc', valueCents: 1000, status: 'paid' }),
    complete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('conciliação da fila PIX', () => {
  it('consulta e registra o estado com a mesma reserva', async () => {
    const d = deps();
    expect((await reconcilePushinPayNotification(request(), 'secret', d)).status).toBe(200);
    expect(d.consult).toHaveBeenCalledWith('abc', 1000, 'deposit');
    expect(d.complete).toHaveBeenCalledWith(item, 'paid', d.claim.mock.calls[0][0]);
  });
  it('recusa acesso e preserva a fila em falhas', async () => {
    const d = deps();
    expect((await reconcilePushinPayNotification(request('wrong'), 'secret', d)).status).toBe(401);
    expect(d.claim).not.toHaveBeenCalled();
    d.consult.mockRejectedValueOnce(new Error('offline'));
    expect((await reconcilePushinPayNotification(request(), 'secret', d)).status).toBe(503);
    expect(d.complete).not.toHaveBeenCalled();
  });
  it('processa imediatamente quando há aviso e informa fila vazia', async () => {
    const d = deps();
    expect(await processNextPushinPayNotification(d)).toBe(true);
    expect(d.complete).toHaveBeenCalledWith(item, 'paid', d.claim.mock.calls[0][0]);
    d.claim.mockResolvedValueOnce(null);
    expect(await processNextPushinPayNotification(d)).toBe(false);
    expect(d.complete).toHaveBeenCalledTimes(1);
  });
});
