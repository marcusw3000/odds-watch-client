/** Valid public probability, including a confirmed zero. */
export function isValidPolymarketPrice(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 && price <= 1;
}
