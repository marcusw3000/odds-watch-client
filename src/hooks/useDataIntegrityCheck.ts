import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DataIntegrityIssue {
  id: string;
  marketId: string;
  marketTitle: string;
  type: 'date_inconsistency' | 'expired_open' | 'long_pending' | 'no_volume';
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export function useDataIntegrityCheck() {
  return useQuery<DataIntegrityIssue[]>({
    queryKey: ['data-integrity'],
    queryFn: async () => {
      const issues: DataIntegrityIssue[] = [];
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const { data: markets } = await supabase
        .from('markets')
        .select('id, title, status, close_date, settlement_date, total_volume, created_at');

      markets?.forEach((m) => {
        // Date inconsistency: Halt > Event
        if (
          m.close_date &&
          m.settlement_date &&
          new Date(m.close_date) > new Date(m.settlement_date)
        ) {
          issues.push({
            id: `date-${m.id}`,
            marketId: m.id,
            marketTitle: m.title,
            type: 'date_inconsistency',
            severity: 'warning',
            description: 'Data de halt posterior ao evento',
          });
        }

        // Expired open market
        if (m.status === 'OPEN' && m.close_date && new Date(m.close_date) < now) {
          issues.push({
            id: `expired-${m.id}`,
            marketId: m.id,
            marketTitle: m.title,
            type: 'expired_open',
            severity: 'critical',
            description: 'Mercado aberto já expirou',
          });
        }

        // Pending for too long (> 7 days)
        if (
          m.status === 'PENDING' &&
          m.close_date &&
          new Date(m.close_date) < sevenDaysAgo
        ) {
          issues.push({
            id: `pending-${m.id}`,
            marketId: m.id,
            marketTitle: m.title,
            type: 'long_pending',
            severity: 'info',
            description: 'Pendente há mais de 7 dias',
          });
        }

        // Open market with no volume for 3+ days
        if (
          m.status === 'OPEN' &&
          (m.total_volume === 0 || m.total_volume === null) &&
          m.created_at &&
          new Date(m.created_at) < threeDaysAgo
        ) {
          issues.push({
            id: `novolume-${m.id}`,
            marketId: m.id,
            marketTitle: m.title,
            type: 'no_volume',
            severity: 'info',
            description: 'Sem volume há 3+ dias',
          });
        }
      });

      // Sort by severity (critical first, then warning, then info)
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
