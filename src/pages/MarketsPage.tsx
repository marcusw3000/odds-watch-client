import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { TrendingUp, RefreshCw, Search } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import MarketDataProvider from '@/services/MarketDataProvider';
import { MarketCard } from '@/components/market/MarketCard';
import { MarketCardSkeleton } from '@/components/market/MarketCardSkeleton';
import { CategoryFilter } from '@/components/market/CategoryFilter';
import { PurchaseModal } from '@/components/market/PurchaseModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface LayoutContext {
  userBalance: number;
  setUserBalance: (balance: number) => void;
}

export function MarketsPage() {
  const { userBalance } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MarketEvent | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO'>('YES');
  const { toast } = useToast();

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const [eventsData, categoriesData] = await Promise.all([
        MarketDataProvider.getEvents(),
        MarketDataProvider.getCategories(),
      ]);
      setEvents(eventsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro ao carregar mercados',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData(false);
  };

  const handleBuy = (eventId: string, outcome: 'YES' | 'NO') => {
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
      setEvents((prev) =>
        prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
      );
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
      // Refresh events to show updated odds
      fetchData(false);
    } else {
      throw new Error(result.message);
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesCategory = !activeCategory || event.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
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
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum mercado encontrado</h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros ou volte mais tarde.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEvents.map((event, index) => (
            <div
              key={event.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <MarketCard 
                event={event} 
                onBuy={handleBuy}
                onViewDetails={handleViewDetails}
              />
            </div>
          ))}
        </div>
      )}

      {/* Purchase Modal */}
      {selectedEvent && (
        <PurchaseModal
          event={selectedEvent}
          selectedOutcome={selectedOutcome}
          userBalance={userBalance}
          onClose={handleCloseModal}
          onConfirm={handleConfirmPurchase}
          onRefreshPrice={handleRefreshPrice}
        />
      )}
    </div>
  );
}
