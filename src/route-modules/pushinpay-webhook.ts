import { createClient } from '@supabase/supabase-js';
import { enqueuePushinPayWebhook } from '@/services/PushinPayWebhook.server';
import type { Route } from './+types/pushinpay-webhook';

export async function action({ request }: Route.ActionArgs) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.PUSHINPAY_WEBHOOK_SECRET;
  if (!url || !serviceKey || !secret) {
    return Response.json({ error: 'Notificações indisponíveis.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return enqueuePushinPayWebhook(request, secret, async (id) => {
    const { error } = await supabase.rpc('pushinpay_enqueue_notification', { p_provider_id: id });
    if (error) throw new Error('Falha ao registrar notificação.');
  });
}
