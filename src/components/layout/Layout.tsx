import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { usePortfolioRefreshListener } from '@/hooks/usePortfolioRefresh';
import { useCachedBalance } from '@/hooks/useCachedBalance';

export function Layout() {
  const location = useLocation();
  const { cachedBalance, updateCache } = useCachedBalance();
  
  // Usar valor cacheado como valor inicial (stale-while-revalidate)
  const [userBalance, setUserBalance] = useState(cachedBalance ?? 0);
  const [isBalanceLoading, setIsBalanceLoading] = useState(cachedBalance === null);

  const fetchBalance = useCallback(async (showLoading = false) => {
    // Só mostrar loading se não temos cache
    if (showLoading && cachedBalance === null) {
      setIsBalanceLoading(true);
    }
    
    try {
      const portfolio = await MarketDataProvider.getUserPortfolio();
      setUserBalance(portfolio.balance);
      updateCache(portfolio.balance); // Salvar no cache
    } catch (err) {
      console.error('Error fetching balance:', err);
      // Em caso de erro, manter valor do cache se disponível
    } finally {
      setIsBalanceLoading(false);
    }
  }, [cachedBalance, updateCache]);

  // Usar valor cacheado imediatamente quando disponível
  useEffect(() => {
    if (cachedBalance !== null) {
      setUserBalance(cachedBalance);
      setIsBalanceLoading(false);
    }
  }, [cachedBalance]);

  useEffect(() => {
    fetchBalance();

    // Atualiza balance periodicamente (15s é suficiente para boa UX)
    const interval = setInterval(() => fetchBalance(false), 15000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Listen for portfolio refresh events (triggered after purchases, sales, etc.)
  const handlePortfolioRefresh = useCallback(() => {
    fetchBalance(true); // Show loading indicator on manual refresh
  }, [fetchBalance]);

  usePortfolioRefreshListener(handlePortfolioRefresh);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Skip link para acessibilidade */}
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
