import type { SupabaseClient } from '@supabase/supabase-js';
import { preparePushinPayWithdrawal, submitPushinPayWithdrawal } from './PushinPayPix.server';
import { protectPixDestination, type PixDestination } from './PushinPayWithdrawalCrypto.server';

export class InsufficientPixBalanceError extends Error {}

export async function createPersistedPushinPayWithdrawal(
  input: { id: string; userId: string; valueCents: number; notificationUrl: string; destination: PixDestination },
  supabase: SupabaseClient, token: string, encryptionKey: string,
) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.id) || !uuid.test(input.userId) || !token.trim()) throw new Error('Dados de saque inválidos.');
  const providerInput = { ...input.destination, valueCents: input.valueCents, notificationUrl: input.notificationUrl };
  preparePushinPayWithdrawal(providerInput);
  const protectedDestination = protectPixDestination(input.destination, input.userId, input.id, input.valueCents, encryptionKey);
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(name, args);
    if (error?.message === 'insufficient balance' && name === 'pushinpay_prepare_brl_withdrawal') throw new InsufficientPixBalanceError();
    if (error) throw new Error('Operação PIX indisponível.');
    return data;
  }
  const initial = await call('pushinpay_prepare_brl_withdrawal', { p_id: input.id, p_user_id: input.userId, p_amount_cents: input.valueCents, p_fingerprint: protectedDestination.fingerprint, p_destination_ciphertext: protectedDestination.ciphertext });
  if (!initial || typeof initial !== 'object' || initial.id !== input.id || initial.user_id !== input.userId || Number(initial.amount_cents) !== input.valueCents || initial.direction !== 'withdrawal' || !['prepared', 'submitting', 'unknown', 'created', 'paid', 'canceled'].includes(initial.status)) throw new Error('Solicitação inconsistente.');
  if (initial.status !== 'prepared') return { id: input.id, valueCents: input.valueCents, status: initial.status };
  const claimed = await call('pushinpay_claim_withdrawal', { p_id: input.id, p_user_id: input.userId });
  if (claimed !== true) {
    if (claimed !== false) throw new Error('Resposta de reserva inválida.');
    const current = await call('pushinpay_get_withdrawal', { p_id: input.id, p_user_id: input.userId });
    if (!current || current.id !== input.id || current.user_id !== input.userId || Number(current.amount_cents) !== input.valueCents || current.direction !== 'withdrawal' || !['prepared', 'submitting', 'unknown', 'created', 'paid', 'canceled'].includes(current.status)) throw new Error('Solicitação indisponível.');
    return { id: input.id, valueCents: input.valueCents, status: current.status };
  }
  try {
    const result = await submitPushinPayWithdrawal(providerInput, token);
    const saved = await call('pushinpay_register_withdrawal', { p_id: input.id, p_user_id: input.userId, p_provider_id: result.id, p_amount_cents: input.valueCents });
    if (!saved || typeof saved !== 'object' || saved.id !== input.id || saved.user_id !== input.userId || saved.status !== 'created') throw new Error('Resposta inválida.');
    return { id: input.id, valueCents: input.valueCents, status: 'created' };
  } catch {
    await call('pushinpay_mark_withdrawal_unknown', { p_id: input.id, p_user_id: input.userId });
    throw new Error('Resultado pendente de conciliação.');
  }
}
