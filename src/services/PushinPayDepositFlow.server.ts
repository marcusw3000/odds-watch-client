import { createHash } from 'node:crypto';
import { preparePushinPayDeposit } from './PushinPayPix.server';

type DepositOperation = {
  id: string;
  userId: string;
  valueCents: number;
  status: 'prepared' | 'submitting' | 'unknown' | 'created' | 'paid' | 'canceled' | 'expired';
  providerId: string | null;
  pixCode: string | null;
};

type DepositDependencies = {
  prepare(input: { id: string; userId: string; valueCents: number; fingerprint: string }): Promise<DepositOperation>;
  claim(id: string, userId: string): Promise<boolean>;
  read(id: string, userId: string): Promise<DepositOperation | null>;
  submit(valueCents: number): Promise<{ id: string; valueCents: number; status: 'created'; pixCode: string }>;
  saveCreated(id: string, userId: string, result: { id: string; valueCents: number; status: 'created'; pixCode: string }): Promise<DepositOperation>;
  markUnknown(id: string, userId: string): Promise<void>;
};

/** O chamador autentica o usuário e verifica os requisitos de depósito antes desta função. */
export async function createDepositIntent(
  input: { id: string; userId: string; valueCents: number; notificationUrl: string },
  dependencies: DepositDependencies,
): Promise<DepositOperation> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.id) || !uuid.test(input.userId)) throw new Error('Identificador inválido.');
  const request = preparePushinPayDeposit(input.valueCents, input.notificationUrl);
  const fingerprint = createHash('sha256').update(JSON.stringify(['deposit', input.userId, request.value, request.webhook_url])).digest('hex');
  const existing = await dependencies.prepare({ id: input.id, userId: input.userId, valueCents: input.valueCents, fingerprint });
  if (existing.id !== input.id || existing.userId !== input.userId || existing.valueCents !== input.valueCents) throw new Error('Solicitação inconsistente.');
  if (existing.status !== 'prepared') return existing;
  if (!await dependencies.claim(input.id, input.userId)) {
    const current = await dependencies.read(input.id, input.userId);
    if (!current || current.id !== input.id || current.userId !== input.userId || current.valueCents !== input.valueCents) throw new Error('Solicitação indisponível.');
    return current;
  }
  try {
    const response = await dependencies.submit(input.valueCents);
    if (response.valueCents !== input.valueCents || response.status !== 'created' || !response.id || !response.pixCode) throw new Error('Resposta inconsistente.');
    return await dependencies.saveCreated(input.id, input.userId, response);
  } catch {
    await dependencies.markUnknown(input.id, input.userId);
    throw new Error('Resultado pendente de conciliação.');
  }
}
