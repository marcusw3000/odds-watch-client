import type { SupabaseClient } from '@supabase/supabase-js';
import { consultPushinPayDeposit, consultPushinPayWithdrawal, isValidPushinPayWithdrawalStatusPath } from './PushinPayPix.server';
import { processNextPushinPayNotification, type PendingPixNotification, type PushinPayQueueDependencies } from './PushinPayReconcile.server';

/**
 * Liga a fila de avisos PIX ao Supabase e à Pushin Pay.
 * `seed` reabre cobranças sem aviso; use apenas na conciliação periódica.
 */
export function createPushinPayQueue(supabase: SupabaseClient, token: string, options: { seed: boolean }): PushinPayQueueDependencies {
  const withdrawalPath = process.env.PUSHINPAY_WITHDRAWAL_STATUS_PATH ?? '/transfers/{id}';
  const includeWithdrawals = isValidPushinPayWithdrawalStatusPath(withdrawalPath);
  return {
    async claim(leaseId) {
      const recovery = await supabase.rpc('pushinpay_mark_stalled_deposits_unknown');
      if (recovery.error) throw new Error('Recovery unavailable');
      let { data, error } = await supabase.rpc('pushinpay_claim_notification_v2', { p_lease_id: leaseId, p_include_withdrawals: includeWithdrawals });
      if (error || !Array.isArray(data)) throw new Error('Queue unavailable');
      if (data.length === 0 && options.seed) {
        const seed = await supabase.rpc('pushinpay_seed_reconciliation_v2', { p_include_withdrawals: includeWithdrawals });
        if (seed.error) throw new Error('Reconciliation unavailable');
        if (seed.data) {
          ({ data, error } = await supabase.rpc('pushinpay_claim_notification_v2', { p_lease_id: leaseId, p_include_withdrawals: includeWithdrawals }));
          if (error || !Array.isArray(data)) throw new Error('Queue unavailable');
        }
      }
      return (data[0] as PendingPixNotification | undefined) ?? null;
    },
    consult(id, value, direction) {
      return direction === 'withdrawal' ? consultPushinPayWithdrawal(id, value, token, withdrawalPath) : consultPushinPayDeposit(id, value, token);
    },
    async complete(operation, status, leaseId) {
      const { error } = await supabase.rpc('pushinpay_complete_notification', {
        p_operation_id: operation.operation_id, p_user_id: operation.user_id,
        p_provider_id: operation.provider_id, p_amount_cents: operation.amount_cents,
        p_revision: operation.revision, p_status: status, p_lease_id: leaseId,
      });
      if (error) throw new Error('Completion unavailable');
    },
  };
}

/**
 * Tenta processar a fila imediatamente, sem propagar falhas.
 * Se a operação foi consultada há menos de um minuto, o aviso continua na fila para a conciliação periódica.
 */
export async function tryProcessPushinPayQueueNow(supabase: SupabaseClient): Promise<boolean> {
  const token = process.env.PUSHINPAY_API_TOKEN;
  if (!token) return false;
  try {
    return await processNextPushinPayNotification(createPushinPayQueue(supabase, token, { seed: false }));
  } catch {
    return false;
  }
}
