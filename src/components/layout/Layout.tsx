import { useCallback, Component, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { Button } from '@/components/ui/button';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { usePortfolioRefreshListener } from '@/hooks/usePortfolioRefresh';
import { queryKeys } from '@/lib/queryKeys';

const MAX_CHAT_RETRIES = 3;

// ErrorBoundary for GlobalChat - renders fallback button on error, retries up to 3 times
class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; retryCount: number }
> {
  state = { hasError: false, retryCount: 0 };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[GlobalChat] Caught error:', error.message);
    if (this.state.retryCount < MAX_CHAT_RETRIES) {
      this.retryTimer = setTimeout(() => {
        this.setState(prev => ({ hasError: false, retryCount: prev.retryCount + 1 }));
      }, 3000 * Math.pow(2, this.state.retryCount));
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Button
          size="icon"
          disabled
          className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg lg:bottom-6 opacity-50"
          title="Chat indisponível"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      );
    }
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
      <main id="main-content" className="flex-1 container mx-auto px-4 py-8 pb-24 lg:pb-8 min-h-[calc(100vh-200px)]" style={{ contain: 'layout' }}>
        <div key={location.pathname} className="animate-fade-in">
          <Outlet context={{ userBalance, setUserBalance }} />
        </div>
      </main>
      <Footer />
      <BottomNav />
      <ChatErrorBoundary>
        <GlobalChat />
      </ChatErrorBoundary>
    </div>
  );
}
