import type { SupabaseClient } from '@supabase/supabase-js';
import { createDepositIntent } from './PushinPayDepositFlow.server';
import { submitPushinPayDeposit } from './PushinPayPix.server';

type OperationStatus = 'prepared' | 'submitting' | 'unknown' | 'created' | 'paid' | 'canceled' | 'expired';
function operation(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Operação indisponível.');
  const row = value as Record<string, unknown>;
  const cents = typeof row.amount_cents === 'string' && /^\d+$/.test(row.amount_cents) ? Number(row.amount_cents) : row.amount_cents;
  if (typeof row.id !== 'string' || typeof row.user_id !== 'string' || !Number.isSafeInteger(cents) ||
      row.direction !== 'deposit' || typeof row.status !== 'string' ||
      !['prepared', 'submitting', 'unknown', 'created', 'paid', 'canceled', 'expired'].includes(row.status) ||
      (row.provider_id !== null && typeof row.provider_id !== 'string') ||
      (row.pix_code !== null && typeof row.pix_code !== 'string')) throw new Error('Operação inconsistente.');
  return { id: row.id, userId: row.user_id, valueCents: cents as number, status: row.status as OperationStatus, providerId: row.provider_id as string | null, pixCode: row.pix_code as string | null };
}

export async function getPersistedPushinPayDeposit(id: string, userId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('pushinpay_get_deposit', { p_id: id, p_user_id: userId });
  if (error) throw new Error('Persistência PIX indisponível.');
  return data === null ? null : operation(data);
}

/** O chamador deve autenticar o usuário antes de criar a solicitação. */
export async function createPersistedPushinPayDeposit(
  input: { id: string; userId: string; valueCents: number; notificationUrl: string },
  supabase: SupabaseClient,
  token: string,
) {
  if (!token.trim()) throw new Error('Credencial Pushin Pay ausente.');
  async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error('Persistência PIX indisponível.');
    return data;
  }
  return createDepositIntent(input, {
    async prepare(item) {
      return operation(await call('pushinpay_prepare_deposit', { p_id: item.id, p_user_id: item.userId, p_amount_cents: item.valueCents, p_fingerprint: item.fingerprint }));
    },
    async claim(id, userId) {
      const result = await call('pushinpay_claim_deposit', { p_id: id, p_user_id: userId });
      if (typeof result !== 'boolean') throw new Error('Resposta de reserva inválida.');
      return result;
    },
    async read(id, userId) {
      const result = await call('pushinpay_get_deposit', { p_id: id, p_user_id: userId });
      return result === null ? null : operation(result);
    },
    async submit(valueCents) {
      const result = await submitPushinPayDeposit(valueCents, input.notificationUrl, token);
      if (result.status !== 'created') throw new Error('Cobrança inválida.');
      return { ...result, status: 'created' };
    },
    async saveCreated(id, userId, result) {
      return operation(await call('pushinpay_save_deposit', { p_id: id, p_user_id: userId, p_provider_id: result.id, p_amount_cents: result.valueCents, p_pix_code: result.pixCode }));
    },
    async markUnknown(id, userId) {
      await call('pushinpay_mark_deposit_unknown', { p_id: id, p_user_id: userId });
    },
  });
}
