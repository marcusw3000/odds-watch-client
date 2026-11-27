import { describe, expect, it, vi } from 'vitest';
import { protectPixDestination, recoverPixDestination } from '../src/services/PushinPayWithdrawalCrypto.server';
import { consultPushinPayWithdrawal, submitPushinPayWithdrawal } from '../src/services/PushinPayPix.server';

const key = Buffer.alloc(32, 1).toString('base64');
const destination = { receiverDocument: '12345678909', pixKeyType: 'email' as const, pixKey: 'user@example.test' };
const input = { ...destination, valueCents: 1000, notificationUrl: 'https://example.test/webhook' };

describe('saque PIX Pushin Pay', () => {
  it('protege o destino e vincula a cifra ao usuário e à operação', () => {
    const first = protectPixDestination(destination, 'user-1', 'operation-1', 1000, key);
    const second = protectPixDestination(destination, 'user-1', 'operation-1', 1000, key);
    expect(first.ciphertext).not.toContain(destination.pixKey);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(recoverPixDestination(first.ciphertext, 'user-1', 'operation-1', key)).toEqual(destination);
    expect(() => recoverPixDestination(first.ciphertext, 'user-2', 'operation-1', key)).toThrow();
    expect(() => protectPixDestination(destination, 'user-1', 'operation-1', 1000, 'invalid')).toThrow();
  });

  it('envia uma tentativa e preserva o resultado incerto em falha', async () => {
    const request = vi.fn().mockImplementation(async () => Response.json({ id: 'test-id', value: 1000, status: 'created', pix_key_type: input.pixKeyType, pix_key: input.pixKey, receiver_national_registration: input.receiverDocument }));
    expect(await submitPushinPayWithdrawal(input, 'test-token', request)).toEqual({ id: 'test-id', valueCents: 1000, status: 'created' });
    expect(request.mock.calls[0][0]).toBe('https://api.pushinpay.com.br/api/pix/cashOut');
    const failure = vi.fn().mockRejectedValue(new Error('timeout'));
    await expect(submitPushinPayWithdrawal(input, 'test-token', failure)).rejects.toThrow(/Concilie/);
    expect(failure).toHaveBeenCalledTimes(1);
    await expect(submitPushinPayWithdrawal({ ...input, pixKey: 'invalid-email' }, 'test-token', request)).rejects.toThrow();
    const wrongDestination = vi.fn().mockImplementation(async () => Response.json({ id: 'test-id', value: 1000, status: 'created', pix_key_type: 'email', pix_key: 'other@example.test', receiver_national_registration: input.receiverDocument }));
    await expect(submitPushinPayWithdrawal(input, 'test-token', wrongDestination)).rejects.toThrow(/Concilie/);
  });

  it('consulta transferências apenas no host fixo e valida identificador e valor', async () => {
    const request = vi.fn().mockImplementation(async () => Response.json({ id: 'test-id', value: '1000', status: 'paid' }));
    expect(await consultPushinPayWithdrawal('test-id', 1000, 'test-token', '/transfers/{id}', request)).toEqual({ id: 'test-id', valueCents: 1000, status: 'paid' });
    expect(request.mock.calls[0][0]).toBe('https://api.pushinpay.com.br/api/transfers/test-id');
    await expect(consultPushinPayWithdrawal('test-id', 1000, 'test-token', 'https://other.test/{id}', request)).rejects.toThrow();
    const wrong = vi.fn().mockImplementation(async () => Response.json({ id: 'other', value: '1000', status: 'paid' }));
    await expect(consultPushinPayWithdrawal('test-id', 1000, 'test-token', '/transfers/{id}', wrong)).rejects.toThrow();
    const expired = vi.fn().mockImplementation(async () => Response.json({ id: 'test-id', value: 1000, status: 'expired' }));
    await expect(consultPushinPayWithdrawal('test-id', 1000, 'test-token', '/transfers/{id}', expired)).rejects.toThrow();
  });
});
