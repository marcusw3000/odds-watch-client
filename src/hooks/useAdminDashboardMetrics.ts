import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminDashboardMetrics {
  totalVolume: number;
  pendingRevenue: number;
  activeUsers7d: number;
  depositsToday: number;
}

export function useAdminDashboardMetrics() {
  return useQuery<AdminDashboardMetrics>({
    queryKey: ['admin-dashboard-metrics'],
    queryFn: async () => {
      // Fetch total volume from all markets
      const { data: volumeData } = await supabase
        .from('markets')
        .select('total_volume');

      const totalVolume = volumeData?.reduce((sum, m) => sum + (m.total_volume || 0), 0) || 0;

      // Fetch today's deposits
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: depositsData } = await supabase
        .from('ledger_entries')
        .select('amount')
        .eq('ref_type', 'DEPOSIT')
        .eq('direction', 'CREDIT')
        .gte('created_at', today.toISOString());

      const depositsToday = depositsData?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      // Fetch pending revenue (fees from PENDING markets)
      const { data: pendingMarkets } = await supabase
        .from('markets')
        .select('id')
        .eq('status', 'PENDING');

      let pendingRevenue = 0;
      if (pendingMarkets && pendingMarkets.length > 0) {
        const marketIds = pendingMarkets.map(m => m.id);
        const { data: pendingFees } = await supabase
          .from('ledger_entries')
          .select('fee_amount')
          .in('ref_id', marketIds)
          .eq('ref_type', 'TRADE');

        pendingRevenue = pendingFees?.reduce((sum, f) => sum + (f.fee_amount || 0), 0) || 0;
      }

      // Fetch active users in last 7 days (distinct users with transactions)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: activeUsersData } = await supabase
        .from('transactions')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString());

      const uniqueUsers = new Set(activeUsersData?.map(t => t.user_id) || []);
      const activeUsers7d = uniqueUsers.size;

      return {
        totalVolume,
        pendingRevenue,
        activeUsers7d,
        depositsToday,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
