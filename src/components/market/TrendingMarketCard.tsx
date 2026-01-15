import { memo, useState } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

  return (
    <div 
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
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

        {/* Right Side - Image/Chart Area */}
        <div className="hidden lg:flex flex-col border-l border-border overflow-hidden">
          {hasImage ? (
            <div className="flex-1 relative overflow-hidden">
              <div
                className={cn(
                  "absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out",
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
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-card/20" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-6 lg:p-8 bg-secondary/30">
              {/* Mini Chart Visualization */}
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full h-48 relative">
                  {/* Category Icon Fallback */}
                  <div 
                    className={cn(
                      "absolute inset-0 flex items-center justify-center text-8xl transition-transform duration-300",
                      isHovered && "scale-110"
                    )}
                  >
                    {getCategoryIcon(event.category)}
                  </div>
                </div>
              </div>
              
              {/* Date labels */}
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'd MMM', { locale: ptBR })}</span>
                <span>{format(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), 'd MMM', { locale: ptBR })}</span>
                <span>{format(new Date(), 'd MMM', { locale: ptBR })}</span>
              </div>
            </div>
          )}
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
