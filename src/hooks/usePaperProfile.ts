import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PaperProfileTrade {
  id: string; market_id: string; question: string; outcome_label: string;
  side: 'BUY' | 'SELL'; created_at: string;
  shares: number | null; price: number | null; notional_usd: number | null;
}

export interface PaperProfileData {
  total_profit: number | null; roi_percent: number | null; total_volume: number | null;
  total_trades: number | null; sales_count: number | null; winning_sales: number | null;
  best_trade_profit: number | null; current_streak: number | null; best_streak: number | null;
  history: PaperProfileTrade[] | null;
}

export function usePaperProfile(userId?: string) {
  return useQuery({
    queryKey: ['paper-profile', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PaperProfileData> => {
      const { data, error } = await (supabase as any).rpc('get_paper_profile', { p_user: userId });
      if (error) throw error;
      if (!data) throw new Error('Dados do perfil indisponíveis.');
      return data as PaperProfileData;
    },
  });
}
