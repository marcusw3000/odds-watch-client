import { memo, useState } from 'react';
import { TrendingUp, Plus, Lock } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketStatusBadge } from '@/components/market/MarketStatusBadge';
import { cn } from '@/lib/utils';

interface CardStyleSimpleProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
}

export const CardStyleSimple = memo(function CardStyleSimple({
  event,
  onBuy,
  onViewDetails,
}: CardStyleSimpleProps) {
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
  const isSettled = statusInfo.status === 'SETTLED';
  const resultIsYes = event.result === 'YES';

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-200",
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

      {/* Header with percentage */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn(
            "flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden relative bg-secondary",
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
              <div className="absolute inset-0 flex items-center justify-center text-xl">
                {getCategoryIcon(event.category)}
              </div>
            )}
          </div>

          <h3 
            className="flex-1 text-sm font-semibold leading-tight line-clamp-3 cursor-pointer hover:text-primary transition-colors"
            onClick={() => onViewDetails?.(event.id)}
          >
            {event.title}
          </h3>
        </div>

        <span className={cn(
          "text-lg font-bold shrink-0",
          isSettled ? (resultIsYes ? "text-yes" : "text-no") : "text-primary"
        )}>
          {yesPrice}%
        </span>
      </div>

      {/* Status badge for non-tradeable markets or spacer for consistency */}
      <div className="mb-3 min-h-[24px]">
        {!statusInfo.canTrade && (
          <MarketStatusBadge 
            status={statusInfo.status}
            timeToEvent={statusInfo.timeToEvent}
            result={event.result}
            size="sm"
          />
        )}
      </div>

      {/* Simple Yes/No buttons or locked state */}
      {statusInfo.canTrade ? (
        <div className="flex gap-2 mb-3">
          <Button
            variant="outline"
            className="flex-1 h-9 border-yes/40 text-yes hover:bg-yes/10 hover:border-yes font-medium"
            onClick={() => onBuy(event.id, 'YES')}
          >
            Yes
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-9 border-no/40 text-no hover:bg-no/10 hover:border-no font-medium"
            onClick={() => onBuy(event.id, 'NO')}
          >
            No
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 mb-3">
          <div className={cn(
            "flex-1 h-9 rounded-md flex items-center justify-center font-medium text-sm border",
            isSettled && resultIsYes 
              ? "bg-yes/10 text-yes border-yes/30" 
              : "bg-muted/50 text-muted-foreground border-border"
          )}>
            {isSettled ? (resultIsYes ? '✓ Yes' : 'Yes') : <Lock className="h-4 w-4" />}
          </div>
          <div className={cn(
            "flex-1 h-9 rounded-md flex items-center justify-center font-medium text-sm border",
            isSettled && !resultIsYes 
              ? "bg-no/10 text-no border-no/30" 
              : "bg-muted/50 text-muted-foreground border-border"
          )}>
            {isSettled ? (!resultIsYes ? '✓ No' : 'No') : <Lock className="h-4 w-4" />}
          </div>
        </div>
      )}

      {/* Payout info */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>R$1 → <span className={cn("font-medium", isSettled && resultIsYes ? "text-yes" : "text-yes")}>R${(100 / yesPrice).toFixed(2)}</span></span>
        <span>R$1 → <span className={cn("font-medium", isSettled && !resultIsYes ? "text-no" : "text-no")}>R${(100 / event.outcomes.NO.price).toFixed(2)}</span></span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
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
