import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Clock, 
  TrendingUp, 
  Users, 
  RefreshCw, 
  Calendar,
  FileText,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { MarketEvent, OddsHistoryPoint } from '@/types/market';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { OddsBadge } from '@/components/market/OddsBadge';
import { CommentSection } from '@/components/market/CommentSection';
import { PurchaseModal } from '@/components/market/PurchaseModal';
import { OddsChart } from '@/components/market/OddsChart';
import { MarketStatusBadge } from '@/components/market/MarketStatusBadge';
import { TradingHaltBanner } from '@/components/market/TradingHaltBanner';
import { ContestationPanel } from '@/components/market/ContestationPanel';
import { ShareButton } from '@/components/social/ShareButton';
import { FavoriteButton } from '@/components/market/FavoriteButton';
import { MarketDetailSkeleton } from '@/components/market/MarketDetailSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { updateMetaTags, resetMetaTags } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { useDeepLink } from '@/hooks/useDeepLink';
import { triggerPortfolioRefresh } from '@/hooks/usePortfolioRefresh';

export function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const deepLink = useDeepLink();
  const { user } = useAuth();
  
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [oddsHistory, setOddsHistory] = useState<OddsHistoryPoint[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO' | null>(null);
  
  const statusInfo = useMarketStatus(event);

  const fetchData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const [eventData, historyData, portfolio] = await Promise.all([
        MarketDataProvider.getEventById(id),
        MarketDataProvider.getOddsHistory(id),
        MarketDataProvider.getUserPortfolio(),
      ]);
      
      if (!eventData) {
        navigate('/markets');
        return;
      }
      
      setEvent(eventData);
      setOddsHistory(historyData);
      setUserBalance(portfolio.balance);
    } catch (error) {
      console.error('Error fetching market details:', error);
      toast({
        title: 'Erro ao carregar mercado',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Update meta tags for social sharing
  useEffect(() => {
    if (event) {
      updateMetaTags({
        title: event.title,
        description: event.description || `Negocie contratos de previsão: ${event.title}`,
        image: event.imageUrl,
        url: `${window.location.origin}/market/${event.id}`,
      });
    }
    
    return () => {
      resetMetaTags();
    };
  }, [event]);

  // Handle deep link action (auto-open buy modal)
  useEffect(() => {
    if (event && deepLink.action === 'buy' && deepLink.outcome) {
      setSelectedOutcome(deepLink.outcome);
      deepLink.clearAction();
    }
  }, [event, deepLink]);

  const handleRefresh = async () => {
    if (!id) return;
    setIsRefreshing(true);
    try {
      const updatedEvent = await MarketDataProvider.refreshOdds(id);
      if (updatedEvent) {
        setEvent(updatedEvent);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshPrice = async () => {
    if (!id) return null;
    const updatedEvent = await MarketDataProvider.refreshOdds(id);
    if (updatedEvent) {
      setEvent(updatedEvent);
    }
    return updatedEvent;
  };

  const handleConfirmPurchase = async (shares: number, maxCost: number) => {
    if (!event || !selectedOutcome) return;

    const result = await MarketDataProvider.purchaseContract(
      event.id,
      selectedOutcome,
      shares,
      maxCost
    );

    if (result.success) {
      toast({
        title: 'Compra realizada!',
        description: `Você comprou ${shares} contratos ${selectedOutcome === 'YES' ? 'SIM' : 'NÃO'} por R$${result.quote?.cost.toFixed(2) || maxCost.toFixed(2)}.`,
      });
      setSelectedOutcome(null);
      // Refresh balance and event
      const [portfolio, updatedEvent] = await Promise.all([
        MarketDataProvider.getUserPortfolio(),
        MarketDataProvider.getEventById(id!),
      ]);
      setUserBalance(portfolio.balance);
      if (updatedEvent) setEvent(updatedEvent);
      // Trigger portfolio refresh for other open tabs/components
      triggerPortfolioRefresh();
    } else {
      throw new Error(result.message);
    }
  };

  if (isLoading) {
    return <MarketDetailSkeleton />;
  }

  if (loadError) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-16 w-16 mx-auto text-destructive/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">Erro ao carregar mercado</h3>
        <p className="text-muted-foreground mb-4">{loadError.message}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => navigate('/markets')}>
            Voltar aos mercados
          </Button>
          <Button onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-2">Mercado não encontrado</h3>
        <Button variant="outline" onClick={() => navigate('/markets')}>
          Voltar aos mercados
        </Button>
      </div>
    );
  }

  const formatVolume = (volume?: number) => {
    if (!volume) return 'R$0';
    if (volume >= 1000000) return `R$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `R$${(volume / 1000).toFixed(0)}K`;
    return `R$${volume}`;
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link 
        to="/markets" 
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos mercados
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
              {event.category}
            </span>
            <MarketStatusBadge
              status={statusInfo.status}
              timeToHalt={statusInfo.timeToHalt}
              timeToEvent={statusInfo.timeToEvent}
              contestTimeRemaining={statusInfo.contestTimeRemaining}
              result={event.result}
              isUrgent={statusInfo.isUrgent}
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">
            {event.title}
          </h1>
          <p className="text-muted-foreground mt-2">
            {event.description}
          </p>
        </div>
        <div className="flex gap-2">
          <FavoriteButton marketId={event.id} showLabel />
          <ShareButton
            title={event.title}
            description={event.description}
            marketId={event.id}
            showLabel
          />
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Trading Halt Banner */}
      <TradingHaltBanner
        status={statusInfo.status}
        timeToHalt={statusInfo.timeToHalt}
        timeToEvent={statusInfo.timeToEvent}
        contestTimeRemaining={statusInfo.contestTimeRemaining}
        result={event.result}
        isUrgent={statusInfo.isUrgent}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" />
              Halt de Trading
            </div>
            <p className="font-semibold">
              {format(event.tradingHaltAt, "dd MMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" />
              Evento
            </div>
            <p className="font-semibold">
              {format(event.eventAt, "dd MMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Volume
            </div>
            <p className="font-semibold font-mono">{formatVolume(event.volume)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Investimento
            </div>
            <p className="font-semibold font-mono">
              R${event.limits.minBuy} - R${event.limits.maxBuy}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chart & Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Odds Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Histórico de Odds (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OddsChart data={oddsHistory} />
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="rules" className="w-full">
            <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 h-auto">
              <TabsTrigger
                value="rules"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <FileText className="h-4 w-4 mr-2" />
                Regras de Liquidação
              </TabsTrigger>
              <TabsTrigger
                value="comments"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Comentários
              </TabsTrigger>
              <TabsTrigger
                value="contestations"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Scale className="h-4 w-4 mr-2" />
                Contestações ({event.contestations?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rules" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  {event.settlementRules && event.settlementRules.length > 0 ? (
                    <ul className="space-y-3">
                      {event.settlementRules.map((rule, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-sm leading-relaxed">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Regras de liquidação não disponíveis para este mercado.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments" className="mt-6">
              <CommentSection marketId={event.id} />
            </TabsContent>

            <TabsContent value="contestations" className="mt-6">
              <ContestationPanel
                event={event}
                contestTimeRemaining={statusInfo.contestTimeRemaining}
                onSubmitContestation={async (reason, evidence) => {
                  // Mock implementation
                  console.log('Contestation submitted:', { reason, evidence });
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Trading Panel */}
        <div className="space-y-4">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Negociar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Odds */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-yes-muted/30 border border-yes/20">
                  <div>
                    <p className="text-sm text-muted-foreground">SIM</p>
                    <OddsBadge 
                      type="YES" 
                      price={event.outcomes.YES.price} 
                      probability={event.outcomes.YES.probability}
                      size="md"
                    />
                  </div>
                  <Button 
                    variant="yes" 
                    onClick={() => {
                      if (!user) {
                        navigate('/auth', { state: { returnTo: `/market/${id}?action=buy&outcome=YES` } });
                        return;
                      }
                      setSelectedOutcome('YES');
                    }}
                    disabled={!statusInfo.canTrade}
                  >
                    Comprar SIM
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-no-muted/30 border border-no/20">
                  <div>
                    <p className="text-sm text-muted-foreground">NÃO</p>
                    <OddsBadge 
                      type="NO" 
                      price={event.outcomes.NO.price} 
                      probability={event.outcomes.NO.probability}
                      size="md"
                    />
                  </div>
                  <Button 
                    variant="no" 
                    onClick={() => {
                      if (!user) {
                        navigate('/auth', { state: { returnTo: `/market/${id}?action=buy&outcome=NO` } });
                        return;
                      }
                      setSelectedOutcome('NO');
                    }}
                    disabled={!statusInfo.canTrade}
                  >
                    Comprar NÃO
                  </Button>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-lg bg-secondary text-sm space-y-2">
                <p className="font-medium">Como funciona?</p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Contrato vencedor paga <span className="font-semibold text-foreground">R${event.contractUnitCost.toFixed(2)}</span></li>
                  <li>• Contrato perdedor paga R$0,00</li>
                  <li>• Lucro = R${event.contractUnitCost.toFixed(2)} - preço de compra</li>
                </ul>
              </div>

              {/* Balance */}
              <div className="pt-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">Seu saldo</p>
                <p className="font-mono font-bold text-lg">R${userBalance.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Purchase Modal */}
      {selectedOutcome && event && (
        <PurchaseModal
          event={event}
          selectedOutcome={selectedOutcome}
          userBalance={userBalance}
          onClose={() => setSelectedOutcome(null)}
          onConfirm={handleConfirmPurchase}
          onRefreshPrice={handleRefreshPrice}
        />
      )}
    </div>
  );
}
