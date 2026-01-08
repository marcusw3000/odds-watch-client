import { useState, useEffect } from 'react';
import { Briefcase, RefreshCw } from 'lucide-react';
import { UserPortfolio } from '@/types/market';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { ContractsList } from '@/components/portfolio/ContractsList';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchPortfolio = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await MarketDataProvider.getUserPortfolio();
      setPortfolio(data);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      toast({
        title: 'Erro ao carregar portfólio',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPortfolio(false);
  };

  const handleContractSold = () => {
    fetchPortfolio(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 rounded animate-shimmer mb-2" />
            <div className="h-5 w-64 rounded animate-shimmer" />
          </div>
          <div className="h-10 w-28 rounded animate-shimmer" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl animate-shimmer" />
          ))}
        </div>
        
        <div className="h-96 rounded-xl animate-shimmer" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="text-center py-16">
        <Briefcase className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-2">Erro ao carregar portfólio</h3>
        <Button variant="outline" onClick={() => fetchPortfolio()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Meu Portfólio
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seus investimentos e resultados
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Portfolio Overview */}
      <PortfolioOverview portfolio={portfolio} />

      {/* Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger
            value="active"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Contratos Ativos
          </TabsTrigger>
          <TabsTrigger
            value="settled"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Finalizados
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <ContractsList 
            contracts={portfolio.contracts} 
            type="active" 
            onContractSold={handleContractSold}
          />
        </TabsContent>

        <TabsContent value="settled" className="mt-6">
          <ContractsList contracts={portfolio.contracts} type="settled" />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <TransactionHistory transactions={portfolio.transactions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
