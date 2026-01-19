import { memo, useState } from 'react';
import { Lock } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { useMarketStatus } from '@/hooks/useMarketStatus';
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
  const [hoveredOutcome, setHoveredOutcome] = useState<'YES' | 'NO' | null>(null);

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
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200",
        "hover:border-primary/30 hover:shadow-md"
      )}
    >
      {/* Header */}
      <div 
        className="p-4 pb-3 cursor-pointer"
        onClick={() => onViewDetails?.(event.id)}
      >
        <div className="flex items-start gap-3">
          {/* Image/Icon */}
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden relative bg-secondary",
            !statusInfo.canTrade && "grayscale opacity-60"
          )}>
            {hasImage ? (
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${event.imageUrl})` }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-lg">
                {getCategoryIcon(event.category)}
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="flex-1 text-sm font-medium leading-snug line-clamp-2 hover:text-primary transition-colors">
            {event.title}
          </h3>
        </div>
      </div>

      {/* Trading buttons - Kalshi style */}
      <div className="px-4 pb-4">
        {statusInfo.canTrade ? (
          <div className="flex gap-2">
            <button
              className={cn(
                "flex-1 h-10 rounded-lg font-semibold text-sm transition-all duration-150",
                "bg-yes/15 text-yes border border-yes/30",
                hoveredOutcome === 'YES' && "bg-yes text-white border-yes shadow-sm"
              )}
              onClick={() => onBuy(event.id, 'YES')}
              onMouseEnter={() => setHoveredOutcome('YES')}
              onMouseLeave={() => setHoveredOutcome(null)}
            >
              Sim {yesPrice}¢
            </button>
            <button
              className={cn(
                "flex-1 h-10 rounded-lg font-semibold text-sm transition-all duration-150",
                "bg-no/15 text-no border border-no/30",
                hoveredOutcome === 'NO' && "bg-no text-white border-no shadow-sm"
              )}
              onClick={() => onBuy(event.id, 'NO')}
              onMouseEnter={() => setHoveredOutcome('NO')}
              onMouseLeave={() => setHoveredOutcome(null)}
            >
              Não {noPrice}¢
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className={cn(
              "flex-1 h-10 rounded-lg flex items-center justify-center font-semibold text-sm border",
              isSettled && resultIsYes 
                ? "bg-yes/15 text-yes border-yes/30" 
                : "bg-muted/50 text-muted-foreground border-border"
            )}>
              {isSettled ? (resultIsYes ? '✓ Sim' : 'Sim') : <Lock className="h-4 w-4" />}
            </div>
            <div className={cn(
              "flex-1 h-10 rounded-lg flex items-center justify-center font-semibold text-sm border",
              isSettled && !resultIsYes 
                ? "bg-no/15 text-no border-no/30" 
                : "bg-muted/50 text-muted-foreground border-border"
            )}>
              {isSettled ? (!resultIsYes ? '✓ Não' : 'Não') : <Lock className="h-4 w-4" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
