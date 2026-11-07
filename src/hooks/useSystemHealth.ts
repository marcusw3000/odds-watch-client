import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminCatalogHealth {
  market_count: number;
  latest_sync: string | null;
  latest_closure_check: string | null;
  jobs: Array<{ name: string; active: boolean; schedule: string; last_status: string | null; last_run: string | null }>;
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['admin-system-health'],
    queryFn: async () => {
      const started = performance.now();
      const [database, auth, catalog] = await Promise.all([
        supabase.from('profiles').select('id').limit(1),
        supabase.auth.getUser(),
        (supabase as any).rpc('get_admin_catalog_health'),
      ]);
      return { database: !database.error, auth: !auth.error && Boolean(auth.data.user), latencyMs: Math.round(performance.now() - started), catalog: catalog.error ? null : catalog.data as AdminCatalogHealth, catalogError: Boolean(catalog.error) };
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
