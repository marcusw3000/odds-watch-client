import { createClient } from '@supabase/supabase-js';
import { getServerAuthState } from '@/integrations/supabase/server';
import type { Route } from './+types/pushinpay-deposit-recheck';

export async function action({ request, url }: Route.ActionArgs) {
  const auth = await getServerAuthState(request);
  const headers = new Headers(auth.headers);
  headers.set('Cache-Control', 'no-store');
  if (!auth.user) return Response.json({ error: 'Faça login.' }, { status: 401, headers });
  if (request.headers.get('Origin') !== new URL(request.url).origin) return Response.json({ error: 'Origem inválida.' }, { status: 403, headers });
  const id = url.searchParams.get('id') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: 'Identificador inválido.' }, { status: 400, headers });
  const projectUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !key) return Response.json({ error: 'Consulta indisponível.' }, { status: 503, headers });
  const db = createClient(projectUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('pushinpay_request_deposit_recheck', { p_id: id, p_user_id: auth.user.id });
  if (error) return Response.json({ error: 'Consulta indisponível.' }, { status: 503, headers });
  if (data !== true) return Response.json({ error: 'Cobrança ainda não vinculada ao provedor.' }, { status: 409, headers });
  return Response.json({ queued: true }, { status: 202, headers });
}
