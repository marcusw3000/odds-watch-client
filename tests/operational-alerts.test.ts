import { describe, expect, it } from 'vitest';
import { getOperationalAlerts } from '../src/lib/operationalAlerts';
import type { AdminOperationalHealth } from '../src/hooks/useSystemHealth';

const base: AdminOperationalHealth = { database_bytes: 0, market_cache_bytes: 0, catalog_last_success: null, catalog_error: false, copy_oldest_check: null, copy_active: 0, copy_pending: 2, snapshot_last_success: null, snapshot_failed_attempts: 0, jobs: [] };

describe('avisos operacionais', () => {
  it('não trata sinais pendentes ou jobs pausados como falha', () => {
    expect(getOperationalAlerts({ ...base, jobs: [{ name: 'cron', active: false, schedule: '* * * * *', last_status: 'failed', last_run: null }] }, Date.now())).toEqual([]);
  });
  it('indica erro de catálogo, atraso de cópia, falha de job e tentativa de portfólio', () => {
    const now = Date.parse('2026-11-18T12:00:00Z');
    const alerts = getOperationalAlerts({ ...base, catalog_error: true, copy_active: 1, copy_oldest_check: '2026-11-18T11:44:00Z', snapshot_failed_attempts: 1, jobs: [{ name: 'cron', active: true, schedule: '* * * * *', last_status: 'failed', last_run: null }] }, now);
    expect(alerts).toHaveLength(4);
  });
  it('sinaliza horário ausente somente para estratégias ativas', () => {
    expect(getOperationalAlerts({ ...base, copy_active: 1 }, Date.now())).toHaveLength(1);
    expect(getOperationalAlerts(base, Date.now())).toHaveLength(0);
  });
});
