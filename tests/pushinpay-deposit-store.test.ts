import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createPersistedPushinPayDeposit } from '../src/services/PushinPayDepositStore.server';

const input = { id: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001', valueCents: 1000, notificationUrl: 'https://example.test/webhook' };

describe('persistência de depósito', () => {
  it('exige credencial antes de registrar ou enviar uma cobrança', async () => {
    const rpc = vi.fn();
    const database = { rpc } as unknown as SupabaseClient;
    await expect(createPersistedPushinPayDeposit(input, database, '')).rejects.toThrow(/Credencial/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('retorna operação existente sem reenviar ao provedor', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: input.id, user_id: input.userId, amount_cents: '1000', direction: 'deposit', status: 'created', provider_id: 'ABC', pix_code: 'pix' }, error: null });
    const database = { rpc } as unknown as SupabaseClient;
    const result = await createPersistedPushinPayDeposit(input, database, 'test-token');
    expect(result.pixCode).toBe('pix');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
