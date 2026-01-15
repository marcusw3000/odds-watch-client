import { memo, useState } from 'react';
import { TrendingUp, Plus } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { cn } from '@/lib/utils';

interface CompactMarketCardProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
}

export const CompactMarketCard = memo(function CompactMarketCard({
  event,
  onBuy,
  onViewDetails,
}: CompactMarketCardProps) {
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

  // Use imageUrl if available, otherwise use category icon
  const hasImage = Boolean(event.imageUrl);

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200",
        "hover:border-primary/30 hover:shadow-md",
        !statusInfo.canTrade && "opacity-60"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Header */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-secondary">
        {hasImage ? (
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
        ) : (
          <div 
            className={cn(
              "absolute inset-0 flex items-center justify-center text-5xl transition-transform duration-300 ease-out",
              isHovered && "scale-110"
            )}
          >
            {getCategoryIcon(event.category)}
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
        
        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-medium">
            {event.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 
          className="text-sm font-semibold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors mb-4"
          onClick={() => onViewDetails?.(event.id)}
        >
          {event.title}
        </h3>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {/* YES Option */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Sim</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-yes">{event.outcomes.YES.price}%</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2.5 text-[10px] font-semibold border-yes/30 hover:bg-yes/10 hover:text-yes hover:border-yes"
                onClick={() => onBuy(event.id, 'YES')}
                disabled={!statusInfo.canTrade}
              >
                Comprar
              </Button>
            </div>
          </div>

          {/* NO Option */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Não</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-no">{event.outcomes.NO.price}%</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2.5 text-[10px] font-semibold border-no/30 hover:bg-no/10 hover:text-no hover:border-no"
                onClick={() => onBuy(event.id, 'NO')}
                disabled={!statusInfo.canTrade}
              >
                Comprar
              </Button>
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
    </div>
  );
});
