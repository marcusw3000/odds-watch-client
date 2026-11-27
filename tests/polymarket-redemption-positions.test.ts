import { describe, expect, it, vi } from 'vitest';
import { getRedemptionPositionsPage, scanRedemptionPositions } from '../src/services/PolymarketRedemptionPositions.server';

const wallet = '0x1234567890123456789012345678901234567890';
const row = { proxy_wallet: wallet, token_id: '123456789012345678901234567890', condition_id: `0x${'a'.repeat(64)}`, current_size: 3, redeemable: true };

describe('read-only redeemable positions', () => {
  it('preserves token identifiers and pagination', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ data: [row], pagination: { next_cursor: 'next' } }));
    const result = await getRedemptionPositionsPage(wallet, null, request);
    expect(result.positions[0]).toMatchObject({ tokenId: row.token_id, classification: { state: 'candidate' } });
    expect(result.nextCursor).toBe('next');
    expect(new URL(String(request.mock.calls[0][0])).searchParams.get('status')).toBe('REDEEMABLE');
  });
  it('rejects another wallet, invalid envelopes and unavailable providers', async () => {
    await expect(getRedemptionPositionsPage(wallet, null, vi.fn().mockResolvedValue(Response.json({ data: [{ ...row, proxy_wallet: `0x${'b'.repeat(40)}` }], pagination: { next_cursor: null } })))).rejects.toThrow();
    await expect(getRedemptionPositionsPage(wallet, null, vi.fn().mockResolvedValue(Response.json({ data: [] })))).rejects.toThrow();
    await expect(getRedemptionPositionsPage(wallet, null, vi.fn().mockResolvedValue(new Response('', { status: 503 })))).rejects.toThrow();
  });
  it('follows cursors and marks a limited scan as incomplete', async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json({ data: [row], pagination: { next_cursor: 'next' } })).mockResolvedValueOnce(Response.json({ data: [], pagination: { next_cursor: null } }));
    expect(await scanRedemptionPositions(wallet, request)).toMatchObject({ complete: true, positions: [{ tokenId: row.token_id }] });
    expect(new URL(String(request.mock.calls[1][0])).searchParams.get('cursor')).toBe('next');
    const limited = vi.fn().mockResolvedValue(Response.json({ data: [row], pagination: { next_cursor: 'next' } }));
    expect(await scanRedemptionPositions(wallet, limited, 1)).toMatchObject({ complete: false, nextCursor: 'next' });
  });
  it('rejects repeated cursors instead of silently truncating', async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ data: [], pagination: { next_cursor: 'same' } })));
    await expect(scanRedemptionPositions(wallet, request)).rejects.toThrow('cursor');
  });
});
