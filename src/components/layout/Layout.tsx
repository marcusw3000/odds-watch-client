import { useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { usePortfolioRefreshListener } from '@/hooks/usePortfolioRefresh';
import { queryKeys } from '@/lib/queryKeys';

export function Layout() {
  const location = useLocation();
  const queryClient = useQueryClient();

  // Use React Query for balance - eliminates waterfall and adds caching
  const { data: userBalance = 0, isLoading: isBalanceLoading } = useQuery({
    queryKey: queryKeys.portfolio.balance,
    queryFn: async () => {
      const portfolio = await MarketDataProvider.getUserPortfolio();
      return portfolio.balance;
    },
    staleTime: 10000, // 10 seconds before considered stale
    refetchInterval: 15000, // Polling every 15 seconds
    refetchOnWindowFocus: true,
  });

  // Optimistic setter for balance - updates cache directly
  const setUserBalance = useCallback((value: number | ((prev: number) => number)) => {
    queryClient.setQueryData(queryKeys.portfolio.balance, (prev: number = 0) => {
      return typeof value === 'function' ? value(prev) : value;
    });
  }, [queryClient]);

  const handlePortfolioRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.balance });
  }, [queryClient]);

  usePortfolioRefreshListener(handlePortfolioRefresh);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
      >
        Pular para conteúdo principal
      </a>
      
      <Header balance={userBalance} isBalanceLoading={isBalanceLoading} />
      <main id="main-content" className="flex-1 container mx-auto px-4 py-8 pb-24 lg:pb-8 min-h-[calc(100vh-200px)]" style={{ contain: 'layout' }}>
        <div key={location.pathname} className="animate-fade-in">
          <Outlet context={{ userBalance, setUserBalance }} />
        </div>
      </main>
      <Footer />
      <BottomNav />
      <GlobalChat />
    </div>
  );
}
