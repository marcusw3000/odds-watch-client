import { timingSafeEqual } from 'node:crypto';
import { parsePushinPayTransaction, type PushinPayPixStatus } from './PushinPayPix.server';

type Operation = { id: string; providerId: string; amountCents: number; direction: 'deposit' | 'withdrawal' };

export type PushinPayWebhookDependencies = {
  secret: string;
  findOperation(providerId: string): Promise<Operation | null>;
  /** Deve reservar a consulta de modo atômico e entre instâncias, com intervalo mínimo de um minuto. */
  claimVerification(operationId: string): Promise<boolean>;
  fetchTransaction(operation: Operation): Promise<{ id: string; valueCents: number; status: PushinPayPixStatus }>;
  /** Deve aplicar a mudança de estado de modo idempotente em uma transação. */
  recordVerifiedStatus(operation: Operation, status: PushinPayPixStatus): Promise<void>;
};

function validSecret(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length > 512 || expected.length > 512) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

async function parseNotification(request: Request, secret: string): Promise<string | Response> {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
  if (!validSecret(request.headers.get('x-pushinpay-token'), secret)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401, headers });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return Response.json({ error: 'Formato inválido.' }, { status: 415, headers });
  }
  let value: unknown;
  try {
    const length = request.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > 8192)) throw new Error('invalid length');
    const reader = request.body?.getReader();
    if (!reader) throw new Error('empty body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new Error('body too large'); }
      chunks.push(part.value);
    }
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return Response.json({ error: 'Corpo inválido.' }, { status: 400, headers });
  }
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(value.id)) {
    return Response.json({ error: 'Identificador inválido.' }, { status: 400, headers });
  }
  return value.id;
}

/** Enfileira o aviso antes de responder, inclusive quando o vínculo ainda está pendente. */
export async function enqueuePushinPayWebhook(request: Request, secret: string, enqueue: (providerId: string) => Promise<void>): Promise<Response> {
  const id = await parseNotification(request, secret);
  if (id instanceof Response) return id;
  try {
    await enqueue(id);
    return Response.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Falha ao registrar notificação.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

/** Recebe apenas o identificador como aviso. Os demais campos vêm da consulta autenticada. */
export async function processPushinPayWebhook(
  request: Request,
  dependencies: PushinPayWebhookDependencies,
): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  const id = await parseNotification(request, dependencies.secret);
  if (id instanceof Response) return id;
  try {
    const operation = await dependencies.findOperation(id);
    if (!operation || operation.providerId.toLowerCase() !== id.toLowerCase()) {
      return Response.json({ error: 'Operação ainda não vinculada.' }, { status: 503, headers });
    }
    if (!await dependencies.claimVerification(operation.id)) {
      return Response.json({ error: 'Aguardando reconciliação.' }, { status: 503, headers: { ...headers, 'Retry-After': '60' } });
    }
    const response = await dependencies.fetchTransaction(operation);
    const verified = parsePushinPayTransaction({ id: response.id, value: response.valueCents, status: response.status }, operation.providerId, operation.amountCents);
    await dependencies.recordVerifiedStatus(operation, verified.status);
    return Response.json({ received: true }, { headers });
  } catch {
    return Response.json({ error: 'Falha ao conciliar notificação.' }, { status: 503, headers });
  }
}
