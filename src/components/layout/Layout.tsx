import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { usePortfolioRefreshListener } from '@/hooks/usePortfolioRefresh';

export function Layout() {
  const location = useLocation();
  const [userBalance, setUserBalance] = useState(0);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);

  const fetchBalance = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsBalanceLoading(true);
    }
    
    try {
      const portfolio = await MarketDataProvider.getUserPortfolio();
      setUserBalance(portfolio.balance);
    } catch (err) {
      console.error('Error fetching balance:', err);
    } finally {
      setIsBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(() => fetchBalance(false), 15000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const handlePortfolioRefresh = useCallback(() => {
    fetchBalance(true);
  }, [fetchBalance]);

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
    </div>
  );
}
