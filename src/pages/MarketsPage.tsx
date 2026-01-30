import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, RefreshCw, Search, Loader2 } from 'lucide-react';
import { MarketEvent, UserContract } from '@/types/market';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { useMarketsRealtime } from '@/hooks/useMarketsRealtime';
import { TrendingMarketCard } from '@/components/market/TrendingMarketCard';
import { CompactMarketCard } from '@/components/market/CompactMarketCard';
import { MarketCardSkeleton } from '@/components/market/MarketCardSkeleton';
import { CategoryFilter } from '@/components/market/CategoryFilter';
import { AdvancedFilters } from '@/components/market/AdvancedFilters';
import { MinimalTradingCard } from '@/components/market/MinimalTradingCard';
import { QuickSort } from '@/components/market/QuickSort';
import { MarketEmptyState } from '@/components/market/MarketEmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { triggerPortfolioRefresh } from '@/hooks/usePortfolioRefresh';
import { Skeleton } from '@/components/ui/skeleton';
import { useFavorites } from '@/hooks/useFavorites';
import { useMarketFilters, MarketFilters } from '@/hooks/useMarketFilters';
import { useInfiniteMarkets } from '@/hooks/useInfiniteMarkets';
import { useViewportSkeletons } from '@/hooks/useViewportSkeletons';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { usePriceHistoryBatch, PriceHistoryContext } from '@/hooks/usePriceHistoryBatch';
import { cn } from '@/lib/utils';

interface LayoutContext {
  userBalance: number;
  setUserBalance: React.Dispatch<React.SetStateAction<number>>;
}

export function MarketsPage() {
  const { userBalance, setUserBalance } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Use realtime hook for markets data
  const { events, isLoading: isLoadingMarkets, refetch } = useMarketsRealtime();
  
  // Favorites system
  const { favoriteIds } = useFavorites();
  
  // Initialize from URL params
  const initialCategory = searchParams.get('category');
  const initialSearch = searchParams.get('q') || '';
  const initialSort = (searchParams.get('sort') as MarketFilters['sortBy']) || 'volume';
  const initialOrder = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
  
  // Advanced filters
  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
    setFilters,
  } = useMarketFilters(favoriteIds);
  
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Store only the ID to avoid re-renders when events array updates
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO'>('YES');
  const [trendingIndex, setTrendingIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [userContracts, setUserContracts] = useState<UserContract[]>([]);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Viewport-aware skeletons
  const skeletonCount = useViewportSkeletons();
  
  // Initialize sort from URL
  useEffect(() => {
    if (initialSort !== filters.sortBy || initialOrder !== filters.sortOrder) {
      setFilters(prev => ({
        ...prev,
        sortBy: initialSort,
        sortOrder: initialOrder,
      }));
    }
  }, []); // Only on mount
  
  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (activeCategory) params.set('category', activeCategory);
    if (searchQuery) params.set('q', searchQuery);
    if (filters.sortBy !== 'volume') params.set('sort', filters.sortBy);
    if (filters.sortOrder !== 'desc') params.set('order', filters.sortOrder);
    if (filters.showFavoritesOnly) params.set('favorites', '1');
    
    setSearchParams(params, { replace: true });
  }, [activeCategory, searchQuery, filters.sortBy, filters.sortOrder, filters.showFavoritesOnly, setSearchParams]);
  
  // Memoize the selected event - only updates when ID changes or the specific event's data changes
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find(e => e.id === selectedEventId) || null;
  }, [selectedEventId, events]);

  // Fetch categories separately (they don't change frequently)
  useEffect(() => {
    MarketDataProvider.getCategories().then(setCategories);
  }, []);

  // Fetch user contracts when logged in
  useEffect(() => {
    const fetchUserContracts = async () => {
      if (!user) {
        setUserContracts([]);
        return;
      }
      try {
        const portfolio = await MarketDataProvider.getUserPortfolio();
        setUserContracts(portfolio.contracts || []);
      } catch (error) {
        console.error('Error fetching user contracts:', error);
      }
    };
    fetchUserContracts();
  }, [user]);

  // Listener for immediate update after user's own trades
  useEffect(() => {
    const handleMarketUpdate = () => refetch();
    window.addEventListener('market-update', handleMarketUpdate);
    return () => window.removeEventListener('market-update', handleMarketUpdate);
  }, [refetch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  // Pull to refresh for mobile
  const { containerRef, pullDistance, pullProgress, isRefreshing: isPullRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const handleBuy = useCallback((eventId: string, outcome: 'YES' | 'NO') => {
    if (!user) {
      navigate('/auth', { state: { returnTo: `/market/${eventId}?action=buy&outcome=${outcome}` } });
      return;
    }
    // Store only the ID to prevent re-renders when events array updates
    setSelectedEventId(eventId);
    setSelectedOutcome(outcome);
  }, [user, navigate]);

  const handleViewDetails = useCallback((eventId: string) => {
    navigate(`/market/${eventId}`);
  }, [navigate]);

  const handleCloseModal = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  const handleRefreshPrice = useCallback(async () => {
    if (!selectedEvent) return null;
    const updatedEvent = await MarketDataProvider.refreshOdds(selectedEvent.id);
    // No need to set state - selectedEvent will auto-update via useMemo when events refresh
    return updatedEvent;
  }, [selectedEvent]);

  const handleConfirmPurchase = async (shares: number, maxCost: number) => {
    if (!selectedEvent) return;

    const result = await MarketDataProvider.purchaseContract(
      selectedEvent.id,
      selectedOutcome,
      shares,
      maxCost
    );

    if (result.success) {
      // Atualização otimista do saldo - imediata!
      const actualCost = result.quote?.cost || maxCost;
      setUserBalance(prev => prev - actualCost);
      
      // Não fechar modal nem mostrar toast - o MinimalTradingCard exibirá o PurchaseSuccessModal
      window.dispatchEvent(new Event('market-update'));
      triggerPortfolioRefresh();
      // Refresh user contracts
      const portfolio = await MarketDataProvider.getUserPortfolio();
      setUserContracts(portfolio.contracts || []);
    } else {
      throw new Error(result.message);
    }
  };

  const handleConfirmSell = async (contractId: string, minValue: number) => {
    const result = await MarketDataProvider.sellContract(contractId, minValue);

    if (result.success) {
      // Atualização otimista do saldo - adiciona valor da venda
      const saleValue = result.saleValue || 0;
      setUserBalance(prev => prev + saleValue);
      
      // Não fechar modal nem mostrar toast - o MinimalTradingCard exibirá o PurchaseSuccessModal
      window.dispatchEvent(new Event('market-update'));
      triggerPortfolioRefresh();
      // Refresh user contracts
      const portfolio = await MarketDataProvider.getUserPortfolio();
      setUserContracts(portfolio.contracts || []);
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

  // Handle sort change
  const handleSortChange = useCallback((sortBy: MarketFilters['sortBy'], order: 'asc' | 'desc') => {
    updateFilter('sortBy', sortBy);
    updateFilter('sortOrder', order);
  }, [updateFilter]);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [events]);

  // Apply search and category filter first, then advanced filters
  const baseFilteredEvents = useMemo(() => events.filter((event) => {
    const matchesCategory = !activeCategory || event.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }), [events, activeCategory, searchQuery]);

  // Apply advanced filters
  const filteredEvents = useMemo(() => applyFilters(baseFilteredEvents), [applyFilters, baseFilteredEvents]);

  // Get trending markets (top 3 by volume or first 3)
  const trendingEvents = useMemo(() => 
    [...filteredEvents]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 3),
    [filteredEvents]
  );

  // Get remaining markets for the grid
  const gridEvents = useMemo(() => 
    filteredEvents.filter(
      (e) => !trendingEvents.slice(0, 1).find((t) => t.id === e.id)
    ),
    [filteredEvents, trendingEvents]
  );

  // Infinite scroll
  const { 
    displayedEvents, 
    hasMore, 
    isLoadingMore, 
    loadMoreRef 
  } = useInfiniteMarkets({ 
    allEvents: gridEvents,
    pageSize: 12,
  });

  // Batch fetch price history for all visible markets - eliminates N+1 queries
  const visibleMarketIds = useMemo(() => 
    displayedEvents.map(e => e.id),
    [displayedEvents]
  );
  const { data: priceHistoryMap } = usePriceHistoryBatch(visibleMarketIds);

  const currentTrendingEvent = trendingEvents[trendingIndex] || trendingEvents[0];

  // Clear handlers for empty state
  const handleClearSearch = useCallback(() => setSearchQuery(''), []);
  const handleClearCategory = useCallback(() => setActiveCategory(null), []);

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="flex justify-center items-center transition-all duration-200 overflow-hidden"
          style={{ height: pullDistance }}
        >
          <RefreshCw 
            className={cn(
              "h-6 w-6 text-primary transition-transform",
              isPullRefreshing && "animate-spin",
              pullProgress >= 1 && "text-primary"
            )} 
            style={{ 
              transform: `rotate(${pullProgress * 180}deg)`,
              opacity: Math.min(pullProgress, 1),
            }}
          />
        </div>
      )}

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
          categoryCounts={categoryCounts}
          totalCount={events.length}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-h-[76px] sm:min-h-[40px]">
          <QuickSort
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={handleSortChange}
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
      <section className="min-h-[600px]" style={{ contain: 'layout' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Todos os mercados</h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {displayedEvents.length} de {gridEvents.length} mercados
          </span>
        </div>

        {isLoadingMarkets ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(skeletonCount)].map((_, i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        ) : gridEvents.length === 0 ? (
          <MarketEmptyState
            searchQuery={searchQuery}
            activeCategory={activeCategory}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            onClearSearch={handleClearSearch}
            onClearCategory={handleClearCategory}
            onSelectCategory={setActiveCategory}
            suggestedCategories={categories}
          />
        ) : (
          <>
            <PriceHistoryContext.Provider value={priceHistoryMap || null}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className={index < 12 ? "animate-fade-in" : ""}
                    style={index < 12 ? { animationDelay: `${(index % 12) * 30}ms` } : undefined}
                  >
                    <CompactMarketCard
                      event={event}
                      onBuy={handleBuy}
                      onViewDetails={handleViewDetails}
                    />
                  </div>
                ))}
              </div>
            </PriceHistoryContext.Provider>
            
            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando mais...</span>
                </div>
              )}
              {!hasMore && gridEvents.length > 12 && (
                <span className="text-sm text-muted-foreground">
                  Você viu todos os mercados
                </span>
              )}
            </div>
          </>
        )}
      </section>

      {/* Trading Modal - Kalshi Style */}
      {selectedEvent && (
        <MinimalTradingCard
          event={selectedEvent}
          initialOutcome={selectedOutcome}
          userBalance={userBalance}
          userContracts={userContracts}
          onClose={handleCloseModal}
          onBuyConfirm={async (outcome, shares, maxCost) => {
            await handleConfirmPurchase(shares, maxCost);
          }}
          onSellConfirm={handleConfirmSell}
        />
      )}
    </div>
  );
}
