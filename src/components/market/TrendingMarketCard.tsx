import { memo, useState, useMemo } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { MarketStatusBadge } from './MarketStatusBadge';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { cn } from '@/lib/utils';

interface TrendingMarketCardProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export const TrendingMarketCard = memo(function TrendingMarketCard({
  event,
  onBuy,
  onViewDetails,
  onPrev,
  onNext,
  currentIndex = 0,
  totalCount = 1,
}: TrendingMarketCardProps) {
  const statusInfo = useMarketStatus(event);
  const [isHovered, setIsHovered] = useState(false);

  const formatVolume = (vol?: number) => {
    if (!vol) return 'R$0';
    if (vol >= 1000000) return `R$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `R$${(vol / 1000).toFixed(0)}k`;
    return `R$${vol}`;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      Economia: '🏛️',
      Câmbio: '💱',
      Esportes: '⚽',
      Mercado: '📈',
      Política: '🗳️',
    };
    return icons[category] || '📊';
  };

  const hasImage = Boolean(event.imageUrl);

  // Generate mock price history data based on created_at
  const priceHistory = useMemo(() => {
    const createdAt = event.createdAt ? new Date(event.createdAt) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysDiff = Math.max(differenceInDays(now, createdAt), 1);
    const dataPoints = Math.min(daysDiff, 14); // Max 14 data points
    
    const data = [];
    const currentPrice = event.outcomes.YES.price;
    
    // Generate random walk from ~50% to current price
    let price = 50;
    const priceStep = (currentPrice - 50) / dataPoints;
    
    for (let i = 0; i <= dataPoints; i++) {
      const date = new Date(createdAt.getTime() + (i * (now.getTime() - createdAt.getTime()) / dataPoints));
      // Add some randomness
      const randomVariation = (Math.random() - 0.5) * 10;
      price = Math.max(1, Math.min(99, price + priceStep + randomVariation));
      
      data.push({
        date: format(date, 'd MMM', { locale: ptBR }),
        price: Math.round(price),
      });
    }
    
    // Ensure last point is the current price
    if (data.length > 0) {
      data[data.length - 1].price = currentPrice;
    }
    
    return data;
  }, [event.createdAt, event.outcomes.YES.price]);

  return (
    <div 
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-0">
        {/* Left Side - Market Info */}
        <div className="p-6 lg:p-8 flex flex-col">
          {/* Category & Status */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">{event.category}</span>
            <MarketStatusBadge
              status={statusInfo.status}
              timeToHalt={statusInfo.timeToHalt}
              result={event.result}
              size="sm"
              showCountdown={statusInfo.isUrgent}
              isUrgent={statusInfo.isUrgent}
            />
          </div>

          {/* Title */}
          <h2 
            className="text-2xl lg:text-3xl font-bold mb-6 cursor-pointer hover:text-primary transition-colors"
            onClick={() => onViewDetails?.(event.id)}
          >
            {event.title}
          </h2>

          {/* Outcomes */}
          <div className="space-y-3 flex-1">
            {/* YES Option */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
              <span className="font-medium">Sim</span>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-yes">{event.outcomes.YES.price}%</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-4 text-xs font-semibold border-yes/30 hover:bg-yes/10 hover:text-yes hover:border-yes"
                    onClick={() => onBuy(event.id, 'YES')}
                    disabled={!statusInfo.canTrade}
                  >
                    Sim
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-4 text-xs font-semibold border-no/30 hover:bg-no/10 hover:text-no hover:border-no"
                    onClick={() => onBuy(event.id, 'NO')}
                    disabled={!statusInfo.canTrade}
                  >
                    Não
                  </Button>
                </div>
              </div>
            </div>

            {/* NO Option */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
              <span className="font-medium">Não</span>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-no">{event.outcomes.NO.price}%</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-4 text-xs font-semibold border-yes/30 hover:bg-yes/10 hover:text-yes hover:border-yes"
                    onClick={() => onBuy(event.id, 'YES')}
                    disabled={!statusInfo.canTrade}
                  >
                    Sim
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-4 text-xs font-semibold border-no/30 hover:bg-no/10 hover:text-no hover:border-no"
                    onClick={() => onBuy(event.id, 'NO')}
                    disabled={!statusInfo.canTrade}
                  >
                    Não
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Description (if available) */}
          {event.description && (
            <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>{formatVolume(event.volume)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onViewDetails?.(event.id)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Center - Image/Icon (small) */}
        <div className="hidden lg:flex items-center justify-center w-32 border-l border-border bg-secondary/20">
          {hasImage ? (
            <div className="w-20 h-20 rounded-full overflow-hidden relative">
              <div
                className={cn(
                  "absolute inset-0 bg-cover bg-center transition-transform duration-300 ease-out",
                  isHovered && "scale-110"
                )}
                style={{
                  backgroundImage: `url(${event.imageUrl})`,
                  backgroundPosition: event.imagePosition 
                    ? `${event.imagePosition.x}% ${event.imagePosition.y}%` 
                    : 'center',
                  transform: isHovered 
                    ? `scale(${(event.imageZoom || 1) * 1.1})` 
                    : `scale(${event.imageZoom || 1})`,
                }}
              />
            </div>
          ) : (
            <div 
              className={cn(
                "w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-4xl transition-transform duration-300",
                isHovered && "scale-110"
              )}
            >
              {getCategoryIcon(event.category)}
            </div>
          )}
        </div>

        {/* Right Side - Price Chart */}
        <div className="hidden lg:flex flex-col p-6 border-l border-border bg-secondary/10">
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Preço']}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Date range labels */}
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{priceHistory[0]?.date}</span>
            <span>{priceHistory[priceHistory.length - 1]?.date}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {totalCount > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={onPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalCount }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={onNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
});
