import { randomUUID, timingSafeEqual } from 'node:crypto';
import { consultPushinPayDeposit } from './PushinPayPix.server';

export type PendingPixNotification = {
  operation_id: string;
  user_id: string;
  provider_id: string;
  amount_cents: number;
  direction: string;
  revision: number;
};

export async function reconcilePushinPayNotification(
  request: Request,
  secret: string,
  deps: {
    claim(leaseId: string): Promise<PendingPixNotification | null>;
    consult(id: string, amountCents: number, direction: 'deposit' | 'withdrawal'): ReturnType<typeof consultPushinPayDeposit>;
    complete(operation: PendingPixNotification, status: 'created' | 'paid' | 'canceled' | 'expired', leaseId: string): Promise<void>;
  },
): Promise<Response> {
  const received = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (!secret || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const lease = randomUUID();
    const operation = await deps.claim(lease);
    if (!operation) return Response.json({ processed: false });
    if (!['deposit', 'withdrawal'].includes(operation.direction) || !Number.isSafeInteger(operation.amount_cents) || !Number.isSafeInteger(operation.revision)) throw new Error('Invalid operation');
    const verified = await deps.consult(operation.provider_id, operation.amount_cents, operation.direction as 'deposit' | 'withdrawal');
    await deps.complete(operation, verified.status, lease);
    return Response.json({ processed: true });
  } catch {
    return Response.json({ error: 'Falha na conciliação.' }, { status: 503 });
  }
}
