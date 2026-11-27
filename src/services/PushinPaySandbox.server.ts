const SANDBOX_URL = 'https://api-sandbox.pushinpay.com.br/api';

/** Creates a sandbox charge. A timeout or malformed response requires manual reconciliation. */
export async function createPushinPaySandboxPix(
  valueCents: number,
  token: string,
  request: typeof fetch = fetch,
) {
  if (!Number.isSafeInteger(valueCents) || valueCents < 50 || !token.trim()) {
    throw new Error('Valor ou credencial de sandbox inválidos.');
  }
  let response: Response;
  try {
    response = await request(`${SANDBOX_URL}/pix/cashIn`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: valueCents }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('Resultado da cobrança desconhecido. Consulte a Pushin Pay antes de repetir.');
  }
  if (!response.ok) throw new Error('Cobrança não confirmada. Consulte a Pushin Pay antes de repetir.');
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('Resposta inválida. Consulte a Pushin Pay antes de repetir.'); }
  if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string' || !data.id.trim() ||
      !('qr_code' in data) || typeof data.qr_code !== 'string' || !data.qr_code.trim() ||
      !('value' in data) || data.value !== valueCents || !('status' in data) || data.status !== 'created') {
    throw new Error('Resposta inválida. Consulte a Pushin Pay antes de repetir.');
  }
  return { id: data.id, pixCode: data.qr_code, valueCents };
}

/** Caller must enforce ownership and a minimum interval of one minute between queries. */
export async function getPushinPaySandboxPix(id: string, expectedValueCents: number, token: string, request: typeof fetch = fetch) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id) || !Number.isSafeInteger(expectedValueCents) || expectedValueCents < 50 || !token.trim()) {
    throw new Error('Dados de consulta inválidos.');
  }
  const response = await request(`${SANDBOX_URL}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Consulta do PIX indisponível.');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('id' in data) || data.id !== id ||
      !('value' in data) || !((typeof data.value === 'string' && /^\d+$/.test(data.value)) || typeof data.value === 'number') || Number(data.value) !== expectedValueCents ||
      !('status' in data) || (data.status !== 'created' && data.status !== 'paid' && data.status !== 'canceled')) {
    throw new Error('Resposta de consulta inválida.');
  }
  return { id, valueCents: expectedValueCents, status: data.status };
}
