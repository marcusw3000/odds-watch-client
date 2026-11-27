import { createClient } from '@supabase/supabase-js';
import { getServerAuthState } from '@/integrations/supabase/server';
import type { Route } from './+types/pushinpay-balance';

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await getServerAuthState(request);
  const headers = new Headers(auth.headers);
  headers.set('Cache-Control', 'no-store');
  if (!auth.user) return Response.json({ error: 'Faça login.' }, { status: 401, headers });
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'Saldo indisponível.' }, { status: 503, headers });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('pushinpay_brl_balance', { p_user_id: auth.user.id });
  if (error || !data || !Number.isSafeInteger(data.available_cents) || !Number.isSafeInteger(data.reserved_cents) || data.available_cents < 0 || data.reserved_cents < 0) {
    return Response.json({ error: 'Saldo indisponível.' }, { status: 503, headers });
  }
  return Response.json({ availableCents: data.available_cents, reservedCents: data.reserved_cents }, { headers });
}
