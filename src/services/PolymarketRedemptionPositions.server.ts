import { classifyRedemptionPosition } from '@/lib/redemptionCandidate';

/** Only call with a wallet already authorized and linked to the current user. */
export async function getRedemptionPositionsPage(wallet: string, cursor: string | null = null, request: typeof fetch = fetch) {
  if (!/^0x[0-9a-f]{40}$/i.test(wallet)) throw new Error('Carteira inválida.');
  if (cursor !== null && (cursor.length === 0 || cursor.length > 2048)) throw new Error('Cursor inválido.');
  const url = new URL('https://data-api.polymarket.com/v2/positions');
  url.searchParams.set('user', wallet);
  url.searchParams.set('status', 'REDEEMABLE');
  url.searchParams.set('limit', '50');
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await request(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Posições indisponíveis na Polymarket.');
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data) || !('pagination' in payload) || !payload.pagination || typeof payload.pagination !== 'object' || !('next_cursor' in payload.pagination)) throw new Error('Resposta inválida da Polymarket.');
  const next = payload.pagination.next_cursor;
  if (next !== null && (typeof next !== 'string' || !next || next.length > 2048)) throw new Error('Cursor inválido da Polymarket.');
  const positions = payload.data.map((row: unknown) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Posição inválida da Polymarket.');
    const item = row as Record<string, unknown>;
    if (typeof item.proxy_wallet !== 'string' || item.proxy_wallet.toLowerCase() !== wallet.toLowerCase() || typeof item.token_id !== 'string' || !/^\d+$/.test(item.token_id) || typeof item.condition_id !== 'string' || !/^0x[0-9a-f]{64}$/i.test(item.condition_id)) throw new Error('Identificação de posição inválida.');
    return { conditionId: item.condition_id, tokenId: item.token_id, currentSize: item.current_size, classification: classifyRedemptionPosition(item) };
  });
  return { positions, nextCursor: next as string | null };
}

/** A bounded scan must never present an incomplete walk as a complete portfolio. */
export async function scanRedemptionPositions(wallet: string, request: typeof fetch = fetch, maxPages = 20) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new Error('Limite de páginas inválido.');
  const positions: Awaited<ReturnType<typeof getRedemptionPositionsPage>>['positions'] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const result = await getRedemptionPositionsPage(wallet, cursor, request);
    positions.push(...result.positions);
    if (result.nextCursor === null) return { positions, complete: true as const };
    if (seen.has(result.nextCursor)) throw new Error('A paginação da Polymarket repetiu um cursor.');
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  return { positions, complete: false as const, nextCursor: cursor };
}
