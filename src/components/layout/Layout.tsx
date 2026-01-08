import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { MarketDataProvider } from '@/services/MarketDataProvider';

export function Layout() {
  const [userBalance, setUserBalance] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      const portfolio = await MarketDataProvider.getUserPortfolio();
      setUserBalance(portfolio.balance);
    };
    fetchBalance();

    // Atualiza balance periodicamente
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header balance={userBalance} />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet context={{ userBalance, setUserBalance }} />
      </main>
      <Footer />
    </div>
  );
}
