import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { usePortfolioRefreshListener } from '@/hooks/usePortfolioRefresh';

export function Layout() {
  const [userBalance, setUserBalance] = useState(0);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const fetchBalance = useCallback(async (showLoading = false) => {
    if (showLoading) setIsBalanceLoading(true);
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

    // Atualiza balance periodicamente
    const interval = setInterval(() => fetchBalance(false), 5000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Listen for portfolio refresh events (triggered after purchases, sales, etc.)
  const handlePortfolioRefresh = useCallback(() => {
    fetchBalance(true); // Show loading indicator on manual refresh
  }, [fetchBalance]);

  usePortfolioRefreshListener(handlePortfolioRefresh);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header balance={userBalance} isBalanceLoading={isBalanceLoading} />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet context={{ userBalance, setUserBalance }} />
      </main>
      <Footer />
    </div>
  );
}
