export function parseDatabaseDiskMetrics(text: string): { size: number; available: number; usedPercent: number } | null {
  const values = new Map<string, number>();
  for (const line of text.split('\n')) {
    const match = /^(node_filesystem_(?:size|avail)_bytes)\{([^}]*)\}\s+([\d.eE+-]+)$/.exec(line.trim());
    if (!match || !/(?:^|,)mountpoint="\/data"(?:,|$)/.test(match[2]) || !/(?:^|,)service_type="db"(?:,|$)/.test(match[2])) continue;
    const value = Number(match[3]);
    if (Number.isFinite(value) && value >= 0) values.set(match[1], value);
  }
  const size = values.get('node_filesystem_size_bytes'), available = values.get('node_filesystem_avail_bytes');
  if (size === undefined || available === undefined || size <= 0 || available > size) return null;
  return { size, available, usedPercent: (1 - available / size) * 100 };
}

export function diskUsageLevel(percent: number): 'normal' | 'warning' | 'critical' | 'unavailable' {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return 'unavailable';
  return percent >= 90 ? 'critical' : percent >= 80 ? 'warning' : 'normal';
}
