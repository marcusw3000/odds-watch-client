import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, RefreshCw, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { UserPortfolio } from '@/types/market';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { ContractsList } from '@/components/portfolio/ContractsList';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
import { DepositModal } from '@/components/payments/DepositModal';
import { WithdrawModal } from '@/components/payments/WithdrawModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useVerifyDeposit } from '@/hooks/usePayments';

export function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const verifyDeposit = useVerifyDeposit();

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

  // Check for deposit success on page load
  useEffect(() => {
    const depositStatus = searchParams.get('deposit');
    const sessionId = searchParams.get('session_id');

    if (depositStatus === 'success' && sessionId) {
      // Verify and credit the deposit
      verifyDeposit.mutate(sessionId, {
        onSuccess: (result) => {
          if (result.success) {
            toast({
              title: '💰 Depósito Confirmado!',
              description: `R$${result.amount?.toFixed(2)} foi creditado na sua conta.`,
            });
            fetchPortfolio(false);
          } else {
            toast({
              title: 'Processando depósito',
              description: result.message,
            });
          }
        },
        onError: () => {
          toast({
            title: 'Erro ao verificar depósito',
            description: 'Verifique seu histórico de transações.',
            variant: 'destructive',
          });
        },
      });

      // Clear URL params
      setSearchParams({});
    } else if (depositStatus === 'cancelled') {
      toast({
        title: 'Depósito cancelado',
        description: 'O pagamento foi cancelado.',
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams]);

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
        <div className="flex items-center gap-2">
          {user && (
            <>
              <Button
                variant="default"
                onClick={() => setShowDepositModal(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Depositar
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowWithdrawModal(true)}
              >
                <ArrowUpFromLine className="h-4 w-4 mr-2" />
                Sacar
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Portfolio Overview */}
      <PortfolioOverview portfolio={portfolio} />

      {/* Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto overflow-x-auto">
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
            Histórico de Trades
          </TabsTrigger>
          <TabsTrigger
            value="payments"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Depósitos/Saques
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

        <TabsContent value="payments" className="mt-6">
          <PaymentHistory />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showDepositModal && (
        <DepositModal onClose={() => setShowDepositModal(false)} />
      )}
      {showWithdrawModal && (
        <WithdrawModal 
          balance={portfolio.balance} 
          onClose={() => setShowWithdrawModal(false)} 
        />
      )}
    </div>
  );
}
