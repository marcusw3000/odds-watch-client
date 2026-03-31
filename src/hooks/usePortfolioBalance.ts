import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { queryKeys } from '@/lib/queryKeys';

type BalanceUpdater = number | ((prev: number) => number);

export function usePortfolioBalance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const balanceQueryKey = queryKeys.portfolio.balance(user?.id);

  const query = useQuery({
    queryKey: balanceQueryKey,
    queryFn: async () => {
      const portfolio = await MarketDataProvider.getUserPortfolio();
      return portfolio.balance;
    },
    enabled: !!user,
    staleTime: 10000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const setBalance = useCallback((value: BalanceUpdater) => {
    queryClient.setQueryData(balanceQueryKey, (prev: number = 0) => {
      return typeof value === 'function' ? value(prev) : value;
    });
  }, [balanceQueryKey, queryClient]);

  const invalidateBalance = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: balanceQueryKey });
  }, [balanceQueryKey, queryClient]);

  return {
    ...query,
    balance: query.data ?? 0,
    setBalance,
    invalidateBalance,
  };
}
