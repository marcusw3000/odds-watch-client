import { memo, useState } from 'react';
import { TrendingUp, Plus, Lock } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketStatusBadge } from '@/components/market/MarketStatusBadge';
import { cn } from '@/lib/utils';

interface CardStyleButtonsProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
}

export const CardStyleButtons = memo(function CardStyleButtons({
  event,
  onBuy,
  onViewDetails,
}: CardStyleButtonsProps) {
  const statusInfo = useMarketStatus(event);
  const [isHovered, setIsHovered] = useState(false);
  const statusColors = getStatusColor(statusInfo.status);

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
  const yesPrice = event.outcomes.YES.price;
  const noPrice = event.outcomes.NO.price;
  const isSettled = statusInfo.status === 'SETTLED';
  const resultIsYes = event.result === 'YES';

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-200 h-[260px] flex flex-col",
        "hover:border-primary/30 hover:shadow-md"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status indicator border */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors",
        statusColors.bg
      )} />

      {/* Header */}
      <div className="flex items-start gap-3 min-h-[56px]">
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full overflow-hidden relative bg-secondary",
          !statusInfo.canTrade && "grayscale"
        )}>
          {hasImage ? (
            <div 
              className={cn(
                "absolute inset-0 bg-cover transition-transform duration-300 ease-out",
                statusInfo.canTrade && isHovered && "scale-110"
              )}
              style={{
                backgroundImage: `url(${event.imageUrl})`,
                backgroundPosition: 'center',
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-lg">
              {getCategoryIcon(event.category)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">{event.category}</p>
          <h3 
            className="text-sm font-semibold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
            onClick={() => onViewDetails?.(event.id)}
          >
            {event.title}
          </h3>
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-2 h-[24px]">
        <MarketStatusBadge 
          status={statusInfo.status}
          timeToEvent={statusInfo.timeToEvent}
          result={event.result}
          size="sm"
        />
      </div>

      {/* Buttons - grows to fill space */}
      <div className="flex-1 flex flex-col justify-center my-3">
        {statusInfo.canTrade ? (
          <div className="flex gap-2">
            <Button
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => onBuy(event.id, 'YES')}
            >
              SIM {yesPrice}¢
            </Button>
            <Button
              className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={() => onBuy(event.id, 'NO')}
            >
              NÃO {noPrice}¢
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className={cn(
              "flex-1 h-10 rounded-md flex items-center justify-center font-bold text-sm",
              isSettled && resultIsYes 
                ? "bg-yes/20 text-yes border border-yes/30" 
                : "bg-muted text-muted-foreground"
            )}>
              {isSettled ? (resultIsYes ? '✓ SIM' : 'SIM') : <Lock className="h-4 w-4" />}
            </div>
            <div className={cn(
              "flex-1 h-10 rounded-md flex items-center justify-center font-bold text-sm",
              isSettled && !resultIsYes 
                ? "bg-no/20 text-no border border-no/30" 
                : "bg-muted text-muted-foreground"
            )}>
              {isSettled ? (!resultIsYes ? '✓ NÃO' : 'NÃO') : <Lock className="h-4 w-4" />}
            </div>
          </div>
        )}

        {/* Payout info */}
        <div className="flex justify-between text-xs text-muted-foreground mt-3">
          <span>R$1 → R${(100 / yesPrice).toFixed(2)}</span>
          <span>R$1 → R${(100 / noPrice).toFixed(2)}</span>
        </div>
      </div>

      {/* Footer - always at bottom */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          <span>{formatVolume(event.volume)}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onViewDetails?.(event.id)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});
