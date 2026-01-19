import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, RefreshCw, Search } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { useMarketsRealtime } from '@/hooks/useMarketsRealtime';
import { TrendingMarketCard } from '@/components/market/TrendingMarketCard';
import { CompactMarketCard } from '@/components/market/CompactMarketCard';
import { MarketCardSkeleton } from '@/components/market/MarketCardSkeleton';
import { CategoryFilter } from '@/components/market/CategoryFilter';
import { AdvancedFilters } from '@/components/market/AdvancedFilters';
import { MinimalTradingCard } from '@/components/market/MinimalTradingCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { triggerPortfolioRefresh } from '@/hooks/usePortfolioRefresh';
import { Skeleton } from '@/components/ui/skeleton';
import { useFavorites } from '@/hooks/useFavorites';
import { useMarketFilters } from '@/hooks/useMarketFilters';

interface LayoutContext {
  userBalance: number;
  setUserBalance: (balance: number) => void;
}

export function MarketsPage() {
  const { userBalance } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Use realtime hook for markets data
  const { events, isLoading: isLoadingMarkets, refetch } = useMarketsRealtime();
  
  // Favorites system
  const { favoriteIds } = useFavorites();
  
  // Advanced filters
  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
  } = useMarketFilters(favoriteIds);
  
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MarketEvent | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO'>('YES');
  const [trendingIndex, setTrendingIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Fetch categories separately (they don't change frequently)
  useEffect(() => {
    MarketDataProvider.getCategories().then(setCategories);
  }, []);

  // Listener for immediate update after user's own trades
  useEffect(() => {
    const handleMarketUpdate = () => refetch();
    window.addEventListener('market-update', handleMarketUpdate);
    return () => window.removeEventListener('market-update', handleMarketUpdate);
  }, [refetch]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleBuy = (eventId: string, outcome: 'YES' | 'NO') => {
    if (!user) {
      navigate('/auth', { state: { returnTo: `/market/${eventId}?action=buy&outcome=${outcome}` } });
      return;
    }
    const event = events.find((e) => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setSelectedOutcome(outcome);
    }
  };

  const handleViewDetails = (eventId: string) => {
    navigate(`/market/${eventId}`);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
  };

  const handleRefreshPrice = async () => {
    if (!selectedEvent) return null;
    const updatedEvent = await MarketDataProvider.refreshOdds(selectedEvent.id);
    if (updatedEvent) {
      setSelectedEvent(updatedEvent);
    }
    return updatedEvent;
  };

  const handleConfirmPurchase = async (shares: number, maxCost: number) => {
    if (!selectedEvent) return;

    const result = await MarketDataProvider.purchaseContract(
      selectedEvent.id,
      selectedOutcome,
      shares,
      maxCost
    );

    if (result.success) {
      toast({
        title: 'Compra realizada!',
        description: `Você comprou ${shares} contratos ${selectedOutcome === 'YES' ? 'SIM' : 'NÃO'} por R$${result.quote?.cost.toFixed(2) || maxCost.toFixed(2)}.`,
      });
      handleCloseModal();
      // Trigger market and portfolio refresh for other open tabs/components
      window.dispatchEvent(new Event('market-update'));
      triggerPortfolioRefresh();
    } else {
      throw new Error(result.message);
    }
  };

  // Auto-play carousel every 5 seconds
  useEffect(() => {
    const trendingCount = Math.min(3, events.length);
    
    if (isAutoPlaying && trendingCount > 1 && !isLoadingMarkets) {
      autoPlayRef.current = setInterval(() => {
        setTrendingIndex((prev) => (prev < trendingCount - 1 ? prev + 1 : 0));
      }, 5000);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, events.length, isLoadingMarkets]);

  const handlePrevTrending = useCallback(() => {
    setIsAutoPlaying(false); // Pause auto-play on manual interaction
    setTrendingIndex((prev) => (prev > 0 ? prev - 1 : Math.min(2, events.length - 1)));
  }, [events.length]);

  const handleNextTrending = useCallback(() => {
    setIsAutoPlaying(false); // Pause auto-play on manual interaction
    setTrendingIndex((prev) => (prev < Math.min(2, events.length - 1) ? prev + 1 : 0));
  }, [events.length]);

  // Apply search and category filter first, then advanced filters
  const baseFilteredEvents = events.filter((event) => {
    const matchesCategory = !activeCategory || event.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Apply advanced filters
  const filteredEvents = applyFilters(baseFilteredEvents);

  // Get trending markets (top 3 by volume or first 3)
  const trendingEvents = [...filteredEvents]
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 3);

  // Get remaining markets for the grid
  const gridEvents = filteredEvents.filter(
    (e) => !trendingEvents.slice(0, 1).find((t) => t.id === e.id)
  );

  const currentTrendingEvent = trendingEvents[trendingIndex] || trendingEvents[0];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Mercados
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore eventos e faça suas previsões
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

      {/* Search & Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mercados..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <CategoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
        <AdvancedFilters
          filters={filters}
          onUpdateFilter={updateFilter}
          onClearFilters={clearFilters}
          categories={categories}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          isLoggedIn={!!user}
        />
      </div>

      {/* Trending Section */}
      {isLoadingMarkets ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : currentTrendingEvent ? (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Em destaque
            </span>
          </div>
          <TrendingMarketCard
            event={currentTrendingEvent}
            onBuy={handleBuy}
            onViewDetails={handleViewDetails}
            onPrev={handlePrevTrending}
            onNext={handleNextTrending}
            currentIndex={trendingIndex}
            totalCount={Math.min(3, trendingEvents.length)}
          />
        </section>
      ) : null}

      {/* Markets Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Todos os mercados</h2>
          <span className="text-sm text-muted-foreground">
            {gridEvents.length} mercados disponíveis
          </span>
        </div>

        {isLoadingMarkets ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        ) : gridEvents.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum mercado encontrado</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters 
                ? 'Tente ajustar os filtros para ver mais resultados.'
                : 'Tente ajustar os filtros ou volte mais tarde.'
              }
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {gridEvents.map((event, index) => (
              <div
                key={event.id}
                className={index < 8 ? "animate-fade-in" : ""}
                style={index < 8 ? { animationDelay: `${index * 30}ms` } : undefined}
              >
                <CompactMarketCard
                  event={event}
                  onBuy={handleBuy}
                  onViewDetails={handleViewDetails}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trading Modal - Kalshi Style */}
      {selectedEvent && (
        <MinimalTradingCard
          event={selectedEvent}
          initialOutcome={selectedOutcome}
          userBalance={userBalance}
          onClose={handleCloseModal}
          onBuyConfirm={async (outcome, shares, maxCost) => {
            await handleConfirmPurchase(shares, maxCost);
          }}
        />
      )}
    </div>
  );
}
