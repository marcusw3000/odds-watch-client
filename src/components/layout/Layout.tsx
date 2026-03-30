import { useCallback, Component, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { usePortfolioRefreshListener } from '@/hooks/usePortfolioRefresh';
import { queryKeys } from '@/lib/queryKeys';

// Silent ErrorBoundary for GlobalChat - renders nothing on error, auto-retries
class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[GlobalChat] Caught error, will retry:', error.message);
    this.retryTimer = setTimeout(() => {
      this.setState({ hasError: false });
    }, 3000);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

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
      <div className="mx-auto flex w-full max-w-[1680px] flex-1 px-4 py-8 pb-24 md:px-6 md:pb-8 2xl:px-8">
        <div className="flex min-h-[calc(100vh-200px)] w-full items-start gap-6 xl:gap-8 2xl:gap-10">
          <main id="main-content" className="min-w-0 flex-1" style={{ contain: 'layout' }}>
            <div key={location.pathname} className="animate-fade-in">
              <Outlet context={{ userBalance, setUserBalance }} />
            </div>
          </main>
          <ChatErrorBoundary>
            <GlobalChat />
          </ChatErrorBoundary>
        </div>
      </div>
      <Footer />
      <BottomNav />
    </div>
  );
}
