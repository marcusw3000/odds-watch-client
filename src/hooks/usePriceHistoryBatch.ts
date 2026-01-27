import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createContext, useContext } from 'react';

export interface PriceHistoryPoint {
  yes_price: number;
  recorded_at: string;
}

export type PriceHistoryMap = Record<string, PriceHistoryPoint[]>;

// Context for passing batch data to sparklines
export const PriceHistoryContext = createContext<PriceHistoryMap | null>(null);

export function usePriceHistoryContext() {
  return useContext(PriceHistoryContext);
}

/**
 * Batch fetch price history for multiple markets in a single query.
 * This eliminates the N+1 query problem where each PriceSparkline 
 * would make its own request.
 */
export function usePriceHistoryBatch(marketIds: string[]) {
  return useQuery({
    queryKey: ['price-history-batch', marketIds.slice().sort().join(',')],
    queryFn: async (): Promise<PriceHistoryMap> => {
      if (marketIds.length === 0) return {};

      const { data, error } = await supabase
        .from('market_price_history')
        .select('market_id, yes_price, recorded_at')
        .in('market_id', marketIds)
        .order('recorded_at', { ascending: true });

      if (error) {
        console.error('Error fetching price history batch:', error);
        return {};
      }

      // Group by market_id, keeping only last 20 points per market for sparklines
      const grouped: PriceHistoryMap = {};
      
      data?.forEach((row) => {
        const marketId = row.market_id;
        if (!grouped[marketId]) {
          grouped[marketId] = [];
        }
        grouped[marketId].push({
          yes_price: row.yes_price,
          recorded_at: row.recorded_at,
        });
      });

      // Limit to last 20 points per market for sparklines
      Object.keys(grouped).forEach((marketId) => {
        const points = grouped[marketId];
        if (points.length > 20) {
          grouped[marketId] = points.slice(-20);
        }
      });

      return grouped;
    },
    staleTime: 60000, // 1 minute cache
    gcTime: 300000, // 5 minute garbage collection
    enabled: marketIds.length > 0,
    refetchOnWindowFocus: false,
  });
}
