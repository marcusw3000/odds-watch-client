import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminDashboardMetrics {
  totalVolume: number;
  totalVolumePrev: number;
  totalVolumeChange: number;
  pendingRevenue: number;
  activeUsers7d: number;
  activeUsers7dPrev: number;
  activeUsers7dChange: number;
  depositsToday: number;
  depositsTodayPrev: number;
  depositsTodayChange: number;
  tradesHoje: number;
  tradesHojePrev: number;
  tradesHojeChange: number;
  ticketMedio: number;
  hasHistoricalData: boolean;
}

interface DailyVolumeSnapshot {
  id: string;
  snapshot_date: string;
  total_platform_volume: number;
  total_trades_count: number;
  active_markets_count: number;
  daily_volume: number;
  daily_trades_count: number;
  created_at: string;
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatDateForQuery(date: Date): string {
  return date.toISOString().split('T')[0];
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

      // Date calculations
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // Fetch yesterday's snapshot for volume comparison
      const { data: yesterdaySnapshot } = await supabase
        .from('daily_volume_snapshots')
        .select('*')
        .eq('snapshot_date', formatDateForQuery(yesterday))
        .single() as { data: DailyVolumeSnapshot | null; error: unknown };

      // Fetch snapshot from 7 days ago for weekly comparison
      const { data: weekAgoSnapshot } = await supabase
        .from('daily_volume_snapshots')
        .select('*')
        .eq('snapshot_date', formatDateForQuery(sevenDaysAgo))
        .single() as { data: DailyVolumeSnapshot | null; error: unknown };

      // Calculate volume comparison from real historical data
      const hasHistoricalData = !!yesterdaySnapshot;
      const totalVolumePrev = yesterdaySnapshot?.total_platform_volume ?? totalVolume;
      const totalVolumeChange = hasHistoricalData 
        ? calcChange(totalVolume, totalVolumePrev)
        : 0;

      // Fetch today's deposits
      const { data: depositsData } = await supabase
        .from('ledger_entries')
        .select('amount')
        .eq('ref_type', 'DEPOSIT')
        .eq('direction', 'CREDIT')
        .gte('created_at', today.toISOString());

      const depositsToday = depositsData?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      // Fetch yesterday's deposits
      const { data: depositsYesterdayData } = await supabase
        .from('ledger_entries')
        .select('amount')
        .eq('ref_type', 'DEPOSIT')
        .eq('direction', 'CREDIT')
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString());

      const depositsTodayPrev = depositsYesterdayData?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

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
      const { data: activeUsersData } = await supabase
        .from('transactions')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString());

      const uniqueUsers = new Set(activeUsersData?.map(t => t.user_id) || []);
      const activeUsers7d = uniqueUsers.size;

      // Fetch active users in previous 7 days (7-14 days ago)
      const { data: activeUsersPrevData } = await supabase
        .from('transactions')
        .select('user_id')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      const uniqueUsersPrev = new Set(activeUsersPrevData?.map(t => t.user_id) || []);
      const activeUsers7dPrev = uniqueUsersPrev.size;

      // Fetch trades today
      const { data: tradesTodayData } = await supabase
        .from('transactions')
        .select('id')
        .gte('created_at', today.toISOString());

      const tradesHoje = tradesTodayData?.length || 0;

      // Use historical snapshot for trades comparison if available
      const tradesHojePrev = yesterdaySnapshot?.daily_trades_count ?? 0;

      // Calculate ticket medio (average deposit amount)
      const ticketMedio = depositsData && depositsData.length > 0 
        ? depositsToday / depositsData.length 
        : 0;

      return {
        totalVolume,
        totalVolumePrev,
        totalVolumeChange,
        pendingRevenue,
        activeUsers7d,
        activeUsers7dPrev,
        activeUsers7dChange: calcChange(activeUsers7d, activeUsers7dPrev),
        depositsToday,
        depositsTodayPrev,
        depositsTodayChange: calcChange(depositsToday, depositsTodayPrev),
        tradesHoje,
        tradesHojePrev,
        tradesHojeChange: calcChange(tradesHoje, tradesHojePrev),
        ticketMedio,
        hasHistoricalData,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
