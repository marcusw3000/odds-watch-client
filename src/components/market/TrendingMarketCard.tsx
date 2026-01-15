import { memo } from 'react';
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

  const formatVolume = (vol?: number) => {
    if (!vol) return 'R$0';
    if (vol >= 1000000) return `R$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `R$${(vol / 1000).toFixed(0)}k`;
    return `R$${vol}`;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
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

        {/* Right Side - Chart Area */}
        <div className="hidden lg:flex flex-col p-6 lg:p-8 bg-secondary/30 border-l border-border">
          {/* Mini Chart Visualization */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full h-48 relative">
              {/* Simplified chart representation */}
              <svg viewBox="0 0 400 150" className="w-full h-full">
                {/* Grid lines */}
                <line x1="0" y1="37.5" x2="400" y2="37.5" stroke="currentColor" strokeOpacity="0.1" />
                <line x1="0" y1="75" x2="400" y2="75" stroke="currentColor" strokeOpacity="0.1" />
                <line x1="0" y1="112.5" x2="400" y2="112.5" stroke="currentColor" strokeOpacity="0.1" />
                
                {/* YES line */}
                <path
                  d={`M 0 ${150 - (event.outcomes.YES.price * 1.5)} 
                      Q 100 ${150 - (event.outcomes.YES.price * 1.4)} 
                        200 ${150 - (event.outcomes.YES.price * 1.45)}
                      T 400 ${150 - (event.outcomes.YES.price * 1.5)}`}
                  fill="none"
                  stroke="hsl(var(--yes))"
                  strokeWidth="2"
                  className="drop-shadow-sm"
                />
                
                {/* Current price label */}
                <text 
                  x="385" 
                  y={150 - (event.outcomes.YES.price * 1.5) - 8} 
                  fill="hsl(var(--yes))" 
                  fontSize="12" 
                  fontWeight="bold"
                  textAnchor="end"
                >
                  {event.outcomes.YES.price}%
                </text>
              </svg>
              
              {/* Y-axis labels */}
              <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between text-xs text-muted-foreground pr-2">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
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
