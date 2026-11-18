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
      const [database, auth, catalog, operational] = await Promise.all([
        supabase.from('profiles').select('id').limit(1),
        supabase.auth.getUser(),
        (supabase as any).rpc('get_admin_catalog_health'),
        (supabase as any).rpc('get_admin_operational_health'),
      ]);
      return { database: !database.error, auth: !auth.error && Boolean(auth.data.user), latencyMs: Math.round(performance.now() - started), catalog: catalog.error ? null : catalog.data as AdminCatalogHealth, catalogError: Boolean(catalog.error), operational: operational.error ? null : operational.data as AdminOperationalHealth };
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
