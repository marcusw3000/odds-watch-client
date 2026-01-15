import { memo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { cn } from '@/lib/utils';

interface CardStyleMinimalProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
}

export const CardStyleMinimal = memo(function CardStyleMinimal({
  event,
  onBuy,
  onViewDetails,
}: CardStyleMinimalProps) {
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
  const yesPrice = event.outcomes.YES.price;
  const noPrice = event.outcomes.NO.price;

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-3 transition-all duration-200",
        "hover:border-primary/30 hover:shadow-sm",
        !statusInfo.canTrade && "opacity-60"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Compact layout */}
      <div className="flex items-center gap-3">
        {/* Image */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden relative bg-secondary">
          {hasImage ? (
            <div 
              className="absolute inset-0 bg-cover"
              style={{
                backgroundImage: `url(${event.imageUrl})`,
                backgroundPosition: 'center',
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm">
              {getCategoryIcon(event.category)}
            </div>
          )}
        </div>

        {/* Title */}
        <h3 
          className="flex-1 text-sm font-medium leading-tight line-clamp-1 cursor-pointer hover:text-primary transition-colors"
          onClick={() => onViewDetails?.(event.id)}
        >
          {event.title}
        </h3>

        {/* Compact buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            className="h-7 px-2.5 bg-yes/20 hover:bg-yes/30 text-yes border-0 text-xs font-bold"
            onClick={() => onBuy(event.id, 'YES')}
            disabled={!statusInfo.canTrade}
          >
            {yesPrice}¢
          </Button>
          <Button
            size="sm"
            className="h-7 px-2.5 bg-no/20 hover:bg-no/30 text-no border-0 text-xs font-bold"
            onClick={() => onBuy(event.id, 'NO')}
            disabled={!statusInfo.canTrade}
          >
            {noPrice}¢
          </Button>
        </div>
      </div>

      {/* Volume - subtle */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2 pl-11">
        <TrendingUp className="h-2.5 w-2.5" />
        <span>{formatVolume(event.volume)}</span>
      </div>
    </div>
  );
});
