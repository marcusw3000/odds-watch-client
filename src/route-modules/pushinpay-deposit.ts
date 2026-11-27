import { createClient } from '@supabase/supabase-js';
import { getServerAuthState } from '@/integrations/supabase/server';
import { createPersistedPushinPayDeposit, getPersistedPushinPayDeposit } from '@/services/PushinPayDepositStore.server';
import type { Route } from './+types/pushinpay-deposit';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function context(request: Request) {
  const auth = await getServerAuthState(request);
  const headers = new Headers(auth.headers);
  headers.set('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { auth, headers, db: url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null };
}

function responseData(value: { id: string; valueCents: number; status: string; pixCode: string | null }) {
  return { id: value.id, valueCents: value.valueCents, status: value.status, pixCode: value.pixCode };
}

export async function loader({ request, url }: Route.LoaderArgs) {
  const { auth, headers, db } = await context(request);
  if (!auth.user) return Response.json({ error: 'Faça login.' }, { status: 401, headers });
  const id = url.searchParams.get('id') ?? '';
  if (!db) return Response.json({ error: 'Depósito indisponível.' }, { status: 503, headers });
  if (!id) {
    const { data, error } = await db.rpc('pushinpay_list_operations', { p_user_id: auth.user.id });
    if (error || !Array.isArray(data)) return Response.json({ error: 'Histórico indisponível.' }, { status: 503, headers });
    return Response.json({ operations: data }, { headers });
  }
  if (!uuid.test(id)) return Response.json({ error: 'Identificador inválido.' }, { status: 400, headers });
  try {
    const item = await getPersistedPushinPayDeposit(id, auth.user.id, db);
    return item ? Response.json(responseData(item), { headers }) : Response.json({ error: 'Depósito não encontrado.' }, { status: 404, headers });
  } catch {
    return Response.json({ error: 'Consulta indisponível.' }, { status: 503, headers });
  }
}

export async function action({ request }: Route.ActionArgs) {
  const { auth, headers, db } = await context(request);
  if (!auth.user) return Response.json({ error: 'Faça login.' }, { status: 401, headers });
  if (request.headers.get('Origin') !== new URL(request.url).origin) return Response.json({ error: 'Origem inválida.' }, { status: 403, headers });
  if (process.env.PUSHINPAY_DEPOSITS_ENABLED !== 'true') return Response.json({ error: 'Depósito PIX em preparação.', code: 'unavailable' }, { status: 503, headers });
  const token = process.env.PUSHINPAY_API_TOKEN;
  const webhook = process.env.PUSHINPAY_WEBHOOK_URL;
  if (!db || !token || !webhook || !process.env.PUSHINPAY_WEBHOOK_SECRET || !process.env.PUSHINPAY_RECONCILE_SECRET) return Response.json({ error: 'Depósito PIX indisponível.', code: 'unavailable' }, { status: 503, headers });
  let payload: unknown;
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 1024) throw new Error('large body');
    const reader = request.body?.getReader();
    if (!reader) throw new Error('empty body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new Error('large body'); }
      chunks.push(chunk.value);
    }
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return Response.json({ error: 'Dados inválidos.' }, { status: 400, headers });
  }
  if (!payload || typeof payload !== 'object' || !('id' in payload) || typeof payload.id !== 'string' || !uuid.test(payload.id) || !('valueCents' in payload) || typeof payload.valueCents !== 'number' || !Number.isSafeInteger(payload.valueCents) || payload.valueCents < 50) {
    return Response.json({ error: 'Dados inválidos.' }, { status: 400, headers });
  }
  try {
    const item = await createPersistedPushinPayDeposit({ id: payload.id, userId: auth.user.id, valueCents: payload.valueCents, notificationUrl: webhook }, db, token);
    return Response.json(responseData(item), { headers });
  } catch {
    return Response.json({ error: 'Não foi possível confirmar o resultado. Consulte o status antes de repetir.' }, { status: 503, headers });
  }
}
