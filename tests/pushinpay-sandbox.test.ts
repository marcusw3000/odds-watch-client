import { describe, expect, it, vi } from 'vitest';
import { createPushinPaySandboxPix, getPushinPaySandboxPix } from '../src/services/PushinPaySandbox.server';

describe('Pushin Pay sandbox', () => {
  it('uses only the sandbox endpoint and validates the charge', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'abc', status: 'created', value: 100, qr_code: 'pix' }), { status: 200 }));
    expect(await createPushinPaySandboxPix(100, 'test-token', request)).toEqual({ id: 'abc', pixCode: 'pix', valueCents: 100 });
    expect(request.mock.calls[0][0]).toBe('https://api-sandbox.pushinpay.com.br/api/pix/cashIn');
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ value: 100 });
  });
  it('does not retry uncertain or inconsistent responses', async () => {
    for (const request of [vi.fn().mockRejectedValue(new Error('timeout')), vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))]) {
      await expect(createPushinPaySandboxPix(100, 'test-token', request)).rejects.toThrow(/antes de repetir/);
      expect(request).toHaveBeenCalledTimes(1);
    }
    const request = vi.fn();
    await expect(createPushinPaySandboxPix(49, 'test-token', request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('validates the identifier and amount when checking a payment', async () => {
    const request = vi.fn().mockImplementation(async () => Response.json({ id: 'abc', value: '100', status: 'paid' }));
    expect(await getPushinPaySandboxPix('abc', 100, 'sandbox-token', request)).toEqual({ id: 'abc', valueCents: 100, status: 'paid' });
    expect(request.mock.calls[0][0]).toBe('https://api-sandbox.pushinpay.com.br/api/transactions/abc');
    await expect(getPushinPaySandboxPix('abc', 200, 'sandbox-token', request)).rejects.toThrow('Resposta de consulta inválida');
    await expect(getPushinPaySandboxPix('../abc', 100, 'sandbox-token', request)).rejects.toThrow('Dados de consulta inválidos');
  });
});
