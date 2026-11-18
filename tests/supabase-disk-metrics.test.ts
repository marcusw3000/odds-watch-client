import { describe, expect, it } from 'vitest';
import { parseDatabaseDiskMetrics } from '../src/lib/supabaseDiskMetrics';

describe('database disk metrics', () => {
  it('uses only the database data mount', () => {
    const value = parseDatabaseDiskMetrics('node_filesystem_size_bytes{service_type="db",mountpoint="/"} 500\nnode_filesystem_size_bytes{service_type="db",mountpoint="/data"} 100\nnode_filesystem_avail_bytes{service_type="db",mountpoint="/data"} 30');
    expect(value).toEqual({ size: 100, available: 30, usedPercent: 70 });
  });
  it('returns unavailable for missing or inconsistent metrics', () => {
    expect(parseDatabaseDiskMetrics('')).toBeNull();
    expect(parseDatabaseDiskMetrics('node_filesystem_size_bytes{service_type="db",mountpoint="/data"} 10\nnode_filesystem_avail_bytes{service_type="db",mountpoint="/data"} 11')).toBeNull();
  });
});
