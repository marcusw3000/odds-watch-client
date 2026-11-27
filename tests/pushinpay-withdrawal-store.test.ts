import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPersistedPushinPayWithdrawal, InsufficientPixBalanceError } from '../src/services/PushinPayWithdrawalStore.server';

const input = { id: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001', valueCents: 1000, notificationUrl: 'https://example.test/webhook', destination: { receiverDocument: '12345678909', pixKeyType: 'email' as const, pixKey: 'test@example.test' } };
const key = Buffer.alloc(32, 1).toString('base64');
const row = { id: input.id, user_id: input.userId, amount_cents: 1000, direction: 'withdrawal', status: 'prepared' };

describe('saque PIX persistido', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reserva antes do envio e não armazena destino em texto aberto', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: row, error: null }).mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: { ...row, status: 'created' }, error: null });
    const request = vi.fn().mockImplementation(async () => Response.json({ id: 'provider-id', status: 'created', value: 1000, pix_key_type: input.destination.pixKeyType, pix_key: input.destination.pixKey, receiver_national_registration: input.destination.receiverDocument }));
    vi.stubGlobal('fetch', request);
    expect(await createPersistedPushinPayWithdrawal(input, { rpc } as unknown as SupabaseClient, 'token', key)).toEqual({ id: input.id, valueCents: 1000, status: 'created' });
    expect(rpc.mock.calls[0][0]).toBe('pushinpay_prepare_brl_withdrawal');
    expect(rpc.mock.calls[0][1].p_destination_ciphertext).not.toContain(input.destination.pixKey);
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(request.mock.invocationCallOrder[0]);
  });
  it('não envia se faltar saldo e marca resultado incerto após falha', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', request);
    const insufficient = vi.fn().mockResolvedValue({ error: { message: 'insufficient balance' }, data: null });
    await expect(createPersistedPushinPayWithdrawal(input, { rpc: insufficient } as unknown as SupabaseClient, 'token', key)).rejects.toBeInstanceOf(InsufficientPixBalanceError);
    expect(request).not.toHaveBeenCalled();
    const rpc = vi.fn().mockResolvedValueOnce({ data: row, error: null }).mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: true, error: null });
    await expect(createPersistedPushinPayWithdrawal(input, { rpc } as unknown as SupabaseClient, 'token', key)).rejects.toThrow(/conciliação/);
    expect(rpc.mock.calls[2][0]).toBe('pushinpay_mark_withdrawal_unknown');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
