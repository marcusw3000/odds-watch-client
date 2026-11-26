/** Preparação e validação do protocolo PIX. A persistência e o envio pertencem ao fluxo transacional. */
export type PushinPayPixStatus = 'created' | 'paid' | 'canceled' | 'expired';
export type PushinPayPixKeyType = 'national_registration' | 'email' | 'phone' | 'evp';

type JsonRecord = Record<string, unknown>;

function amountInCents(value: number): void {
  if (!Number.isSafeInteger(value) || value < 50) throw new Error('Valor PIX inválido.');
}

function webhookUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('URL de notificação inválida.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('URL de notificação inválida.');
  return url.toString();
}

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta PIX inválida.');
  return value as JsonRecord;
}

function parseTransaction(value: unknown, expectedValueCents: number, expectedId?: string) {
  amountInCents(expectedValueCents);
  const data = record(value);
  const valueCents = typeof data.value === 'string' && /^\d+$/.test(data.value) ? Number(data.value) : data.value;
  if (typeof data.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(data.id) ||
      (expectedId !== undefined && data.id.toLowerCase() !== expectedId.toLowerCase()) ||
      valueCents !== expectedValueCents ||
      (data.status !== 'created' && data.status !== 'paid' && data.status !== 'canceled' && data.status !== 'expired')) {
    throw new Error('Resposta PIX inconsistente.');
  }
  return { id: data.id, valueCents: expectedValueCents, status: data.status as PushinPayPixStatus };
}

export function preparePushinPayDeposit(valueCents: number, notificationUrl: string) {
  amountInCents(valueCents);
  return { value: valueCents, webhook_url: webhookUrl(notificationUrl) };
}

export function parsePushinPayDeposit(value: unknown, expectedValueCents: number) {
  const transaction = parseTransaction(value, expectedValueCents);
  const data = record(value);
  if (transaction.status !== 'created' || typeof data.qr_code !== 'string' || !data.qr_code.trim()) {
    throw new Error('Cobrança PIX inconsistente.');
  }
  return { ...transaction, pixCode: data.qr_code };
}

export function preparePushinPayWithdrawal(input: {
  valueCents: number;
  receiverDocument: string;
  pixKeyType: PushinPayPixKeyType;
  pixKey: string;
  notificationUrl: string;
}) {
  amountInCents(input.valueCents);
  if (!/^\d{11}(\d{3})?$/.test(input.receiverDocument) ||
      !['national_registration', 'email', 'phone', 'evp'].includes(input.pixKeyType) ||
      typeof input.pixKey !== 'string' || !input.pixKey.trim() || input.pixKey !== input.pixKey.trim() || input.pixKey.length > 255) {
    throw new Error('Dados de saque PIX inválidos.');
  }
  const validKey = {
    national_registration: /^\d{11}(\d{3})?$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\+55\d{10,11}$/,
    evp: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  };
  if (!validKey[input.pixKeyType].test(input.pixKey)) throw new Error('Chave PIX inválida.');
  return {
    value: input.valueCents,
    receiver_national_registration: input.receiverDocument,
    pix_key_type: input.pixKeyType,
    pix_key: input.pixKey,
    webhook_url: webhookUrl(input.notificationUrl),
  };
}

/** Chamar apenas depois da reserva e da aquisição atômica da solicitação. */
export async function submitPushinPayWithdrawal(
  input: Parameters<typeof preparePushinPayWithdrawal>[0], token: string, request: typeof fetch = fetch,
) {
  const body = preparePushinPayWithdrawal(input);
  if (!token.trim()) throw new Error('Credencial Pushin Pay ausente.');
  let response: Response;
  try {
    response = await request('https://api.pushinpay.com.br/api/pix/cashOut', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('Resultado desconhecido. Concilie o saque antes de reenviar.');
  }
  if (!response.ok) throw new Error('Resultado desconhecido. Concilie o saque antes de reenviar.');
  try {
    const payload: unknown = await response.json();
    const transaction = parseTransaction(payload, input.valueCents);
    const data = record(payload);
    if (transaction.status === 'expired' || data.pix_key_type !== input.pixKeyType || data.pix_key !== input.pixKey || data.receiver_national_registration !== input.receiverDocument) {
      throw new Error('Destination mismatch');
    }
    return transaction;
  } catch {
    throw new Error('Resposta inconsistente. Concilie o saque antes de reenviar.');
  }
}

export function parsePushinPayTransaction(value: unknown, expectedId: string, expectedValueCents: number) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(expectedId)) throw new Error('Identificador PIX inválido.');
  return parseTransaction(value, expectedValueCents, expectedId);
}

/** O controle de frequência e a autorização da operação são responsabilidade do chamador. */
export async function consultPushinPayDeposit(id: string, valueCents: number, token: string, request: typeof fetch = fetch) {
  if (!/^[A-Za-z0-9-]{1,100}$/.test(id) || !token.trim()) throw new Error('Consulta PIX inválida.');
  amountInCents(valueCents);
  const response = await request(`https://api.pushinpay.com.br/api/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Consulta PIX indisponível.');
  return parsePushinPayTransaction(await response.json(), id, valueCents);
}

export function isValidPushinPayWithdrawalStatusPath(pathTemplate: string) {
  return /^\/(?:[A-Za-z0-9_-]+\/)+\{id\}$/.test(pathTemplate);
}

export async function consultPushinPayWithdrawal(id: string, valueCents: number, token: string, pathTemplate: string, request: typeof fetch = fetch) {
  if (!/^[A-Za-z0-9-]{1,100}$/.test(id) || !token.trim() || !isValidPushinPayWithdrawalStatusPath(pathTemplate)) throw new Error('Consulta de saque não configurada.');
  amountInCents(valueCents);
  const path = pathTemplate.replace('{id}', encodeURIComponent(id));
  const response = await request(`https://api.pushinpay.com.br/api${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Consulta de saque indisponível.');
  const transaction = parsePushinPayTransaction(await response.json(), id, valueCents);
  if (transaction.status === 'expired') throw new Error('Estado de saque não reconhecido.');
  return transaction;
}

/** Chamar somente após registrar e adquirir a solicitação de forma atômica. */
export async function submitPushinPayDeposit(
  valueCents: number,
  notificationUrl: string,
  token: string,
  request: typeof fetch = fetch,
) {
  const body = preparePushinPayDeposit(valueCents, notificationUrl);
  if (!token.trim()) throw new Error('Credencial Pushin Pay ausente.');
  let response: Response;
  try {
    response = await request('https://api.pushinpay.com.br/api/pix/cashIn', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('Resultado desconhecido. Concilie a cobrança antes de reenviar.');
  }
  if (!response.ok) throw new Error('Resultado desconhecido. Concilie a cobrança antes de reenviar.');
  try {
    return parsePushinPayDeposit(await response.json(), valueCents);
  } catch {
    throw new Error('Resposta inconsistente. Concilie a cobrança antes de reenviar.');
  }
}
