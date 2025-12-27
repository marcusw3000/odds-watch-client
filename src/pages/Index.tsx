import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MarketsPage } from '@/pages/MarketsPage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import MarketDataProvider from '@/services/MarketDataProvider';

type Page = 'markets' | 'portfolio';

const Index = () => {
  const [currentPage, setCurrentPage] = useState<Page>('markets');
  const [userBalance, setUserBalance] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      const portfolio = await MarketDataProvider.getUserPortfolio();
      setUserBalance(portfolio.balance);
    };
    fetchBalance();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        balance={userBalance}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />

      <main className="flex-1 container mx-auto px-4 py-8">
        {currentPage === 'markets' ? (
          <MarketsPage userBalance={userBalance} />
        ) : (
          <PortfolioPage />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Index;
