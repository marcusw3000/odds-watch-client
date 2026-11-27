import { createClient } from '@supabase/supabase-js';
import { getServerAuthState } from '@/integrations/supabase/server';
import { createPersistedPushinPayWithdrawal, InsufficientPixBalanceError } from '@/services/PushinPayWithdrawalStore.server';
import { isValidPushinPayWithdrawalStatusPath, preparePushinPayWithdrawal } from '@/services/PushinPayPix.server';
import type { PixDestination } from '@/services/PushinPayWithdrawalCrypto.server';
import type { Route } from './+types/pushinpay-withdrawal';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function action({ request }: Route.ActionArgs) {
  const auth = await getServerAuthState(request);
  const headers = new Headers(auth.headers);
  headers.set('Cache-Control', 'no-store');
  if (!auth.user) return Response.json({ error: 'Faça login.' }, { status: 401, headers });
  if (request.headers.get('Origin') !== new URL(request.url).origin) return Response.json({ error: 'Origem inválida.' }, { status: 403, headers });
  if (process.env.PUSHINPAY_WITHDRAWALS_ENABLED !== 'true') return Response.json({ error: 'Saque PIX em preparação.', code: 'unavailable' }, { status: 503, headers });
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.PUSHINPAY_API_TOKEN;
  const encryptionKey = process.env.PUSHINPAY_ENCRYPTION_KEY;
  const webhook = process.env.PUSHINPAY_WEBHOOK_URL;
  if (!url || !key || !token || !encryptionKey || !webhook || !process.env.PUSHINPAY_WEBHOOK_SECRET || !process.env.PUSHINPAY_RECONCILE_SECRET || !isValidPushinPayWithdrawalStatusPath(process.env.PUSHINPAY_WITHDRAWAL_STATUS_PATH ?? '/transfers/{id}')) return Response.json({ error: 'Saque PIX indisponível.', code: 'unavailable' }, { status: 503, headers });
  let data: unknown;
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 2048) throw new Error('large body');
    const reader = request.body?.getReader();
    if (!reader) throw new Error('empty body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new Error('large body'); }
      chunks.push(chunk.value);
    }
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return Response.json({ error: 'Dados inválidos.' }, { status: 400, headers }); }
  if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string' || !uuid.test(data.id) || !('valueCents' in data) || typeof data.valueCents !== 'number' || !Number.isSafeInteger(data.valueCents) || data.valueCents < 50 || !('receiverDocument' in data) || typeof data.receiverDocument !== 'string' || !('pixKey' in data) || typeof data.pixKey !== 'string' || !('pixKeyType' in data) || typeof data.pixKeyType !== 'string' || !['national_registration', 'email', 'phone', 'evp'].includes(data.pixKeyType)) {
    return Response.json({ error: 'Dados inválidos.' }, { status: 400, headers });
  }
  const destination: PixDestination = { receiverDocument: data.receiverDocument, pixKey: data.pixKey, pixKeyType: data.pixKeyType as PixDestination['pixKeyType'] };
  try { preparePushinPayWithdrawal({ ...destination, valueCents: data.valueCents, notificationUrl: webhook }); }
  catch { return Response.json({ error: 'Confira o documento e a chave PIX.', code: 'invalid_input' }, { status: 400, headers }); }
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const item = await createPersistedPushinPayWithdrawal({ id: data.id, userId: auth.user.id, valueCents: data.valueCents, notificationUrl: webhook, destination }, db, token, encryptionKey);
    return Response.json(item, { headers });
  } catch (error) {
    if (error instanceof InsufficientPixBalanceError) return Response.json({ error: 'Saldo real insuficiente para este saque.', code: 'insufficient_balance' }, { status: 422, headers });
    return Response.json({ error: 'Não foi possível concluir o saque. Consulte o histórico antes de tentar novamente.' }, { status: 503, headers });
  }
}
