import { requireAdminUser } from '@/integrations/supabase/server';
import { parseDatabaseDiskMetrics } from '@/lib/supabaseDiskMetrics';
import type { Route } from './+types/admin-disk-metrics';

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAdminUser(request);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: 'Métricas de disco não configuradas.' }, { status: 503, headers: auth.headers });
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/customer/v1/privileged/metrics`, { headers: { Authorization: `Basic ${Buffer.from(`service_role:${key}`).toString('base64')}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Metrics unavailable');
    const disk = parseDatabaseDiskMetrics(await response.text());
    if (!disk) throw new Error('Disk metric unavailable');
    const headers = new Headers(auth.headers); headers.set('Cache-Control', 'no-store');
    return Response.json({ ...disk, observedAt: new Date().toISOString() }, { headers });
  } catch {
    return Response.json({ error: 'Métricas de disco indisponíveis.' }, { status: 503, headers: auth.headers });
  }
}
