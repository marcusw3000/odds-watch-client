import { memo, useState } from 'react';
import { TrendingUp, Plus } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { cn } from '@/lib/utils';

interface CardStyleDefaultProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
}

export const CardStyleDefault = memo(function CardStyleDefault({
  event,
  onBuy,
  onViewDetails,
}: CardStyleDefaultProps) {
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
      economia: '🏛️',
      câmbio: '💱',
      esportes: '⚽',
      mercado: '📈',
      política: '🗳️',
    };
    return icons[category] || '📊';
  };

  const hasImage = Boolean(event.imageUrl);

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-200",
        "hover:border-primary/30 hover:shadow-md",
        !statusInfo.canTrade && "opacity-60"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with image and title */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden relative bg-secondary">
          {hasImage ? (
            <div 
              className={cn(
                "absolute inset-0 bg-cover transition-transform duration-300 ease-out",
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
          ) : (
            <div 
              className={cn(
                "absolute inset-0 flex items-center justify-center text-lg transition-transform duration-300 ease-out",
                isHovered && "scale-110"
              )}
            >
              {getCategoryIcon(event.category)}
            </div>
          )}
        </div>

        <h3 
          className="flex-1 text-sm font-semibold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
          onClick={() => onViewDetails?.(event.id)}
        >
          {event.title}
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">Sim</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-muted-foreground">{event.outcomes.YES.price}%</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] font-medium border-yes/30 hover:bg-yes/10 hover:text-yes hover:border-yes"
                onClick={() => onBuy(event.id, 'YES')}
                disabled={!statusInfo.canTrade}
              >
                Yes
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] font-medium border-no/30 hover:bg-no/10 hover:text-no hover:border-no"
                onClick={() => onBuy(event.id, 'NO')}
                disabled={!statusInfo.canTrade}
              >
                No
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">Não</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-muted-foreground">{event.outcomes.NO.price}%</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] font-medium border-yes/30 hover:bg-yes/10 hover:text-yes hover:border-yes"
                onClick={() => onBuy(event.id, 'YES')}
                disabled={!statusInfo.canTrade}
              >
                Yes
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] font-medium border-no/30 hover:bg-no/10 hover:text-no hover:border-no"
                onClick={() => onBuy(event.id, 'NO')}
                disabled={!statusInfo.canTrade}
              >
                No
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
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
