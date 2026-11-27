export type PaperHistoryPoint = { time: number; value: number };

export function summarizePaperHistory(points: PaperHistoryPoint[]) {
  if (!points.length) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return { first, last, change: points.length > 1 ? last.value - first.value : null, count: points.length };
}

export function paperPositionProfit(value: number | null, cost: number): number | null {
  return value !== null && Number.isFinite(value) && Number.isFinite(cost) && cost >= 0 ? value - cost : null;
}
