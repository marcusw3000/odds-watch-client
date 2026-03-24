import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, RefreshCw, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { ContractsList } from '@/components/portfolio/ContractsList';
import { BalanceHistoryFiltered } from '@/components/portfolio/BalanceHistoryFiltered';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
const DepositModal = lazy(() => import('@/components/payments/DepositModal').then(m => ({ default: m.DepositModal })));
import { WithdrawModal } from '@/components/payments/WithdrawModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useVerifyDeposit } from '@/hooks/usePayments';
import { usePortfolioRefreshListener } from '@/hooks/usePortfolioRefresh';
import { useSecurePortfolio, useSecureDataRefresh } from '@/hooks/useSecureData';

export function PortfolioPage() {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const verifyDeposit = useVerifyDeposit();

  // Use secure Edge Function to fetch portfolio data
  const { data: portfolio, isLoading, refetch, isRefetching } = useSecurePortfolio();
  const { refreshPortfolio } = useSecureDataRefresh();

  const fetchPortfolio = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Check for deposit success on page load
  useEffect(() => {
    const depositStatus = searchParams.get('deposit');
    const sessionId = searchParams.get('session_id');

    if (depositStatus === 'success' && sessionId) {
      let attempts = 0;
      const maxAttempts = 12;
      
      const checkPayment = () => {
        verifyDeposit.mutate(sessionId, {
          onSuccess: (result) => {
            if (result.success) {
              toast({
                title: '💰 Depósito Confirmado!',
                description: `R$${result.amount?.toFixed(2)} foi creditado na sua conta.`,
              });
              fetchPortfolio();
              setSearchParams({});
            } else if (result.status === 'unpaid' && attempts < maxAttempts) {
              attempts++;
              toast({
                title: '⏳ Aguardando pagamento PIX',
                description: `Verificando confirmação... (tentativa ${attempts}/${maxAttempts})`,
              });
              setTimeout(checkPayment, 10000);
            } else {
              toast({
                title: 'Pagamento não confirmado',
                description: result.message || 'Verifique seu histórico de transações.',
                variant: 'destructive',
              });
              setSearchParams({});
            }
          },
          onError: () => {
            toast({
              title: 'Erro ao verificar depósito',
              description: 'Verifique seu histórico de transações.',
              variant: 'destructive',
            });
            setSearchParams({});
          },
        });
      };

      checkPayment();
    } else if (depositStatus === 'cancelled') {
      toast({
        title: 'Depósito cancelado',
        description: 'O pagamento foi cancelado.',
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams]);

  // Listen for portfolio refresh events
  usePortfolioRefreshListener(fetchPortfolio);

  const handleRefresh = () => {
    fetchPortfolio();
  };

  const handleContractSold = () => {
    fetchPortfolio();
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
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
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
          <BalanceHistoryFiltered transactions={portfolio.transactions} />
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <PaymentHistory />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showDepositModal && (
        <Suspense fallback={null}>
          <DepositModal onClose={() => setShowDepositModal(false)} />
        </Suspense>
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
