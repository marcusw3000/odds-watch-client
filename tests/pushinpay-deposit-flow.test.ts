import { describe, expect, it, vi } from 'vitest';
import { createDepositIntent } from '../src/services/PushinPayDepositFlow.server';

const input = { id: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001', valueCents: 1000, notificationUrl: 'https://example.test/webhook' };
function fixture() {
  const operation = { id: input.id, userId: input.userId, valueCents: input.valueCents, status: 'prepared' as const, providerId: null, pixCode: null };
  return {
    prepare: vi.fn().mockResolvedValue(operation),
    claim: vi.fn().mockResolvedValue(true),
    read: vi.fn().mockResolvedValue(operation),
    submit: vi.fn().mockResolvedValue({ id: 'provider-1', valueCents: 1000, status: 'created' as const, pixCode: 'pix' }),
    saveCreated: vi.fn().mockResolvedValue({ ...operation, status: 'created', providerId: 'provider-1', pixCode: 'pix' }),
    markUnknown: vi.fn().mockResolvedValue(undefined),
  };
}

describe('solicitação de depósito PIX', () => {
  it('registra antes de enviar e retorna a cobrança persistida', async () => {
    const deps = fixture();
    const result = await createDepositIntent(input, deps);
    expect(result.status).toBe('created');
    expect(deps.prepare).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/) }));
    expect(deps.claim.mock.invocationCallOrder[0]).toBeLessThan(deps.submit.mock.invocationCallOrder[0]);
  });

  it('não reenvia uma operação já iniciada ou adquirida por outra execução', async () => {
    const deps = fixture();
    deps.prepare.mockResolvedValueOnce({ id: input.id, userId: input.userId, valueCents: input.valueCents, status: 'unknown', providerId: null, pixCode: null });
    expect((await createDepositIntent(input, deps)).status).toBe('unknown');
    expect(deps.submit).not.toHaveBeenCalled();
    deps.claim.mockResolvedValueOnce(false);
    await createDepositIntent(input, deps);
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it('exige conciliação após falha de envio ou de persistência', async () => {
    for (const failure of ['submit', 'saveCreated'] as const) {
      const deps = fixture();
      deps[failure].mockRejectedValueOnce(new Error('unavailable'));
      await expect(createDepositIntent(input, deps)).rejects.toThrow(/conciliação/);
      expect(deps.submit).toHaveBeenCalledTimes(1);
      expect(deps.markUnknown).toHaveBeenCalledWith(input.id, input.userId);
    }
  });
});
