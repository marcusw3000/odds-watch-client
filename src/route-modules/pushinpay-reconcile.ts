import { createClient } from '@supabase/supabase-js';
import { consultPushinPayDeposit, consultPushinPayWithdrawal, isValidPushinPayWithdrawalStatusPath } from '@/services/PushinPayPix.server';
import { reconcilePushinPayNotification, type PendingPixNotification } from '@/services/PushinPayReconcile.server';
import type { Route } from './+types/pushinpay-reconcile';

export async function loader({ request }: Route.LoaderArgs) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.PUSHINPAY_API_TOKEN;
  const secret = process.env.PUSHINPAY_RECONCILE_SECRET;
  const withdrawalPath = process.env.PUSHINPAY_WITHDRAWAL_STATUS_PATH ?? '/transfers/{id}';
  const includeWithdrawals = isValidPushinPayWithdrawalStatusPath(withdrawalPath);
  if (!url || !serviceKey || !token || !secret) return Response.json({ error: 'Conciliação indisponível.' }, { status: 503 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return reconcilePushinPayNotification(request, secret, {
    async claim(leaseId) {
      const recovery = await supabase.rpc('pushinpay_mark_stalled_deposits_unknown');
      if (recovery.error) throw new Error('Recovery unavailable');
      let { data, error } = await supabase.rpc('pushinpay_claim_notification_v2', { p_lease_id: leaseId, p_include_withdrawals: includeWithdrawals });
      if (error || !Array.isArray(data)) throw new Error('Queue unavailable');
      if (data.length === 0) {
        const seed = await supabase.rpc('pushinpay_seed_reconciliation_v2', { p_include_withdrawals: includeWithdrawals });
        if (seed.error) throw new Error('Reconciliation unavailable');
        if (seed.data) {
          ({ data, error } = await supabase.rpc('pushinpay_claim_notification_v2', { p_lease_id: leaseId, p_include_withdrawals: includeWithdrawals }));
          if (error || !Array.isArray(data)) throw new Error('Queue unavailable');
        }
      }
      return (data[0] as PendingPixNotification | undefined) ?? null;
    },
    consult(id, value, direction) { return direction === 'withdrawal' ? consultPushinPayWithdrawal(id, value, token, withdrawalPath) : consultPushinPayDeposit(id, value, token); },
    async complete(operation, status, leaseId) {
      const { error } = await supabase.rpc('pushinpay_complete_notification', {
        p_operation_id: operation.operation_id, p_user_id: operation.user_id,
        p_provider_id: operation.provider_id, p_amount_cents: operation.amount_cents,
        p_revision: operation.revision, p_status: status, p_lease_id: leaseId,
      });
      if (error) throw new Error('Completion unavailable');
    },
  });
}
