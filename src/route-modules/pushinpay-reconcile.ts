import { createClient } from '@supabase/supabase-js';
import { createPushinPayQueue } from '@/services/PushinPayQueue.server';
import { reconcilePushinPayNotification } from '@/services/PushinPayReconcile.server';
import type { Route } from './+types/pushinpay-reconcile';

export async function loader({ request }: Route.LoaderArgs) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.PUSHINPAY_API_TOKEN;
  const secret = process.env.PUSHINPAY_RECONCILE_SECRET;
  if (!url || !serviceKey || !token || !secret) return Response.json({ error: 'Conciliação indisponível.' }, { status: 503 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return reconcilePushinPayNotification(request, secret, createPushinPayQueue(supabase, token, { seed: true }));
}
