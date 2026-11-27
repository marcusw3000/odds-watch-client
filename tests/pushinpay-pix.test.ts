import { describe, expect, it, vi } from 'vitest';
import { consultPushinPayDeposit, parsePushinPayDeposit, parsePushinPayTransaction, preparePushinPayDeposit, preparePushinPayWithdrawal, submitPushinPayDeposit } from '../src/services/PushinPayPix.server';

describe('contrato PIX Pushin Pay', () => {
  it('prepara cobranças em centavos e aceita apenas resposta consistente', () => {
    expect(preparePushinPayDeposit(5000, 'https://example.com/webhook')).toEqual({ value: 5000, webhook_url: 'https://example.com/webhook' });
    expect(parsePushinPayDeposit({ id: 'abc', value: 5000, status: 'created', qr_code: 'pix' }, 5000)).toEqual({ id: 'abc', valueCents: 5000, status: 'created', pixCode: 'pix' });
    for (const value of [0, 49, -100, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => preparePushinPayDeposit(value, 'https://example.com/webhook')).toThrow();
    }
    expect(() => parsePushinPayDeposit({ id: 'abc', value: 100, status: 'paid', qr_code: 'pix' }, 100)).toThrow();
    expect(() => parsePushinPayDeposit({ id: 'abc', value: 101, status: 'created', qr_code: 'pix' }, 100)).toThrow();
    expect(() => preparePushinPayDeposit(100, 'http://example.com')).toThrow();
  });

  it('prepara o saque com documento e chave e valida a notificação', () => {
    const input = { valueCents: 5000, receiverDocument: '12345678909', pixKeyType: 'email' as const, pixKey: 'test@example.com', notificationUrl: 'https://example.com/webhook' };
    expect(preparePushinPayWithdrawal(input)).toEqual({ value: 5000, receiver_national_registration: '12345678909', pix_key_type: 'email', pix_key: 'test@example.com', webhook_url: 'https://example.com/webhook' });
    expect(() => preparePushinPayWithdrawal({ ...input, receiverDocument: '' })).toThrow();
    expect(() => preparePushinPayWithdrawal({ ...input, pixKey: ' ' })).toThrow();
    expect(() => preparePushinPayWithdrawal({ ...input, pixKeyType: 'other' as never })).toThrow();
  });

  it('confere a transação consultada sem tratar estados desconhecidos como pagamento', () => {
    expect(parsePushinPayTransaction({ id: 'ABC', value: '5000', status: 'paid' }, 'abc', 5000)).toEqual({ id: 'ABC', valueCents: 5000, status: 'paid' });
    for (const response of [{ id: 'other', value: 5000, status: 'paid' }, { id: 'abc', value: 1, status: 'paid' }, { id: 'abc', value: 5000, status: 'pending' }]) {
      expect(() => parsePushinPayTransaction(response, 'abc', 5000)).toThrow();
    }
  });

  it('envia uma cobrança por tentativa e exige conciliação em respostas incertas', async () => {
    const request = vi.fn().mockImplementation(async () => Response.json({ id: 'abc', value: 1000, status: 'created', qr_code: 'pix' }));
    expect(await submitPushinPayDeposit(1000, 'https://example.com/webhook', 'token-teste', request)).toMatchObject({ id: 'abc', valueCents: 1000 });
    expect(request.mock.calls[0][0]).toBe('https://api.pushinpay.com.br/api/pix/cashIn');
    const failed = vi.fn().mockRejectedValue(new Error('timeout'));
    await expect(submitPushinPayDeposit(1000, 'https://example.com/webhook', 'token-teste', failed)).rejects.toThrow(/Concilie/);
    expect(failed).toHaveBeenCalledTimes(1);
    const inconsistent = vi.fn().mockImplementation(async () => Response.json({ id: 'abc', value: 999, status: 'created', qr_code: 'pix' }));
    await expect(submitPushinPayDeposit(1000, 'https://example.com/webhook', 'token-teste', inconsistent)).rejects.toThrow(/Concilie/);
  });

  it('consulta a cobrança no endpoint oficial e confere os dados', async () => {
    const request = vi.fn().mockImplementation(async () => Response.json({ id: 'ABC', value: '1000', status: 'paid' }));
    expect(await consultPushinPayDeposit('abc', 1000, 'token-teste', request)).toEqual({ id: 'ABC', valueCents: 1000, status: 'paid' });
    expect(request.mock.calls[0][0]).toBe('https://api.pushinpay.com.br/api/transactions/abc');
    await expect(consultPushinPayDeposit('../abc', 1000, 'token-teste', request)).rejects.toThrow();
    const expired = vi.fn().mockImplementation(async () => Response.json({ id: 'abc', value: '1000', status: 'expired' }));
    expect((await consultPushinPayDeposit('abc', 1000, 'token-teste', expired)).status).toBe('expired');
  });
});
