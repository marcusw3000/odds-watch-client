import { memo, useState } from 'react';
import { TrendingUp, Plus, Lock } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketStatusBadge } from '@/components/market/MarketStatusBadge';
import { MarketTags } from '@/components/market/MarketTags';
import { RecurrenceLabel } from '@/components/market/RecurrenceLabel';
import { FavoriteButton } from '@/components/market/FavoriteButton';
import { PriceSparkline } from '@/components/market/PriceSparkline';
import { formatVolume, optimizeImageUrl } from '@/lib/formatters';
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
  const statusColors = getStatusColor(statusInfo.status);

  // formatVolume is now imported from @/lib/formatters

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
  const isSettled = statusInfo.status === 'SETTLED';
  const resultIsYes = event.result === 'YES';

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-200 min-h-[280px] flex flex-col",
        "hover:border-primary/30 hover:shadow-md hover:scale-[1.01]"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status indicator border */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors",
        statusColors.bg
      )} />

      {/* Header with image and title */}
      <div className="flex items-start gap-3 min-h-[48px]">
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
                backgroundImage: `url(${optimizeImageUrl(event.imageUrl, { width: 80 })})`,
                backgroundPosition: event.imagePosition 
                  ? `${event.imagePosition.x}% ${event.imagePosition.y}%` 
                  : 'center',
                transform: statusInfo.canTrade && isHovered 
                  ? `scale(${(event.imageZoom || 1) * 1.1})` 
                  : `scale(${event.imageZoom || 1})`,
              }}
            />
          ) : (
            <div 
              className={cn(
                "absolute inset-0 flex items-center justify-center text-lg transition-transform duration-300 ease-out",
                statusInfo.canTrade && isHovered && "scale-110"
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

      {/* Recurrence + Tags */}
      {((event.recurrenceType && event.recurrenceType !== 'none') || (event.tags && event.tags.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {event.recurrenceType && event.recurrenceType !== 'none' && (
            <RecurrenceLabel type={event.recurrenceType} size="sm" />
          )}
          {event.tags && event.tags.length > 0 && (
            <MarketTags tags={event.tags} maxTags={2} size="sm" />
          )}
        </div>
      )}

      {/* Status badge */}
      <div className="mt-2 h-[24px]">
        <MarketStatusBadge 
          status={statusInfo.status}
          timeToEvent={statusInfo.timeToEvent}
          result={event.result}
          options={event.options}
          size="sm"
        />
      </div>

      {/* Options - grows to fill space */}
      <div className="flex-1 flex flex-col justify-center space-y-2 my-3">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs text-muted-foreground truncate max-w-[100px]",
            isSettled && resultIsYes && "text-yes font-medium"
          )}>Sim</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-bold text-muted-foreground",
              isSettled && resultIsYes && "text-yes"
            )}>{event.outcomes.YES.price}%</span>
            <div className="flex gap-1">
              {statusInfo.canTrade ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] font-medium border-yes/30 hover:bg-yes/10 hover:text-yes hover:border-yes"
                    onClick={() => onBuy(event.id, 'YES')}
                  >
                    Sim
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] font-medium border-no/30 hover:bg-no/10 hover:text-no hover:border-no"
                    onClick={() => onBuy(event.id, 'NO')}
                  >
                    Não
                  </Button>
                </>
              ) : (
                <div className="flex gap-1 h-6">
                  <div className="h-6 px-2 rounded-md border border-border bg-muted/40 text-muted-foreground flex items-center justify-center text-[10px] font-medium">
                    <Lock className="h-3 w-3" />
                  </div>
                  <div className="h-6 px-2 rounded-md border border-border bg-muted/40 text-muted-foreground flex items-center justify-center text-[10px] font-medium">
                    <Lock className="h-3 w-3" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs text-muted-foreground truncate max-w-[100px]",
            isSettled && !resultIsYes && "text-no font-medium"
          )}>Não</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-bold text-muted-foreground",
              isSettled && !resultIsYes && "text-no"
            )}>{event.outcomes.NO.price}%</span>
            <div className="flex gap-1">
              {statusInfo.canTrade ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] font-medium border-yes/30 hover:bg-yes/10 hover:text-yes hover:border-yes"
                    onClick={() => onBuy(event.id, 'YES')}
                  >
                    Sim
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] font-medium border-no/30 hover:bg-no/10 hover:text-no hover:border-no"
                    onClick={() => onBuy(event.id, 'NO')}
                  >
                    Não
                  </Button>
                </>
              ) : (
                <div className="flex gap-1 h-6">
                  <div className="h-6 px-2 rounded-md border border-border bg-muted/40 text-muted-foreground flex items-center justify-center text-[10px] font-medium">
                    <Lock className="h-3 w-3" />
                  </div>
                  <div className="h-6 px-2 rounded-md border border-border bg-muted/40 text-muted-foreground flex items-center justify-center text-[10px] font-medium">
                    <Lock className="h-3 w-3" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - always at bottom */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PriceSparkline eventId={event.id} currentPrice={event.outcomes.YES.price} />
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{formatVolume(event.volume)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <FavoriteButton marketId={event.id} size="sm" />
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