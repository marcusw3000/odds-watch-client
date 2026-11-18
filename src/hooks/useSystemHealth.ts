import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminCatalogHealth {
  market_count: number;
  latest_sync: string | null;
  latest_closure_check: string | null;
  jobs: Array<{ name: string; active: boolean; schedule: string; last_status: string | null; last_run: string | null }>;
}

export interface AdminOperationalHealth {
  database_bytes: number; market_cache_bytes: number; catalog_last_success: string | null; catalog_error: boolean;
  copy_oldest_check: string | null; copy_active: number; copy_pending: number;
  snapshot_last_success: string | null; snapshot_failed_attempts: number;
  jobs: AdminCatalogHealth['jobs'];
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['admin-system-health'],
    queryFn: async () => {
      const started = performance.now();
      const [database, auth, catalog, operational, http, catalogExecution] = await Promise.all([
        supabase.from('profiles').select('id').limit(1),
        supabase.auth.getUser(),
        (supabase as any).rpc('get_admin_catalog_health'),
        (supabase as any).rpc('get_admin_operational_health'),
        (supabase as any).rpc('get_admin_http_health'),
        (supabase as any).rpc('get_admin_catalog_execution_health'),
      ]);
      return { database: !database.error, auth: !auth.error && Boolean(auth.data.user), latencyMs: Math.round(performance.now() - started), catalog: catalog.error ? null : catalog.data as AdminCatalogHealth, catalogError: Boolean(catalog.error), operational: operational.error ? null : operational.data as AdminOperationalHealth, http: http.error ? null : http.data as Array<{ job_name: string; requested_at: string; status_code: number | null; status: string }>, catalogExecution: catalogExecution.error ? null : catalogExecution.data as { error_kind: string | null; last_cron_duration_ms: number | null; last_market_cycle_duration_ms?: number | null; last_event_cycle_duration_ms?: number | null } };
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

export function useDiskMetrics() {
  return useQuery({
    queryKey: ['admin-disk-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/disk-metrics');
      if (!response.ok) throw new Error('Métricas de disco indisponíveis');
      return response.json() as Promise<{ usedPercent: number; size: number; available: number; observedAt: string }>;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
}
