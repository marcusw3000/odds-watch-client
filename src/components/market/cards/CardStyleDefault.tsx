import { memo, useState } from 'react';
import { TrendingUp, Lock } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketStatusBadge } from '@/components/market/MarketStatusBadge';
import { RecurrenceLabel } from '@/components/market/RecurrenceLabel';
import { FavoriteButton } from '@/components/market/FavoriteButton';
import { PriceSparkline } from '@/components/market/PriceSparkline';
import { formatVolume, optimizeImageUrl } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { gridClasses, getCategoryIcon, OptionRow } from './CardGridLayout';

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

  const hasImage = Boolean(event.imageUrl);
  const isSettled = statusInfo.status === 'SETTLED';
  const resultIsYes = event.result === 'YES';

  return (
    <div 
      className={cn(gridClasses.container, "group")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status indicator border */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors",
        statusColors.bg
      )} />

      {/* Zone 1: Header */}
      <div className={gridClasses.header}>
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
            <div className={cn(
              "absolute inset-0 flex items-center justify-center text-lg transition-transform duration-300 ease-out",
              statusInfo.canTrade && isHovered && "scale-110"
            )}>
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

      {/* Zone 2: Status */}
      <div className={gridClasses.status}>
        <MarketStatusBadge 
          status={statusInfo.status}
          timeToEvent={statusInfo.timeToEvent}
          result={event.result}
          options={event.options}
          size="sm"
        />
        {event.recurrenceType && event.recurrenceType !== 'none' && (
          <RecurrenceLabel type={event.recurrenceType} size="sm" />
        )}
      </div>

      {/* Zone 3: Options */}
      <div className={gridClasses.options}>
        <OptionRow 
          label="Sim" 
          price={event.outcomes.YES.price} 
          isWinner={isSettled && resultIsYes}
          variant="yes"
        />
        <OptionRow 
          label="Não" 
          price={event.outcomes.NO.price} 
          isWinner={isSettled && !resultIsYes}
          variant="no"
        />
      </div>

      {/* Zone 4: Buttons */}
      <div className={gridClasses.buttons}>
        {statusInfo.canTrade ? (
          <>
            <Button
              className="flex-1 h-10 bg-yes/10 hover:bg-yes/20 text-yes border border-yes/30 font-bold"
              variant="outline"
              onClick={() => onBuy(event.id, 'YES')}
            >
              Comprar Sim
            </Button>
            <Button
              className="flex-1 h-10 bg-no/10 hover:bg-no/20 text-no border border-no/30 font-bold"
              variant="outline"
              onClick={() => onBuy(event.id, 'NO')}
            >
              Comprar Não
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Zone 5: Footer */}
      <div className={gridClasses.footer}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PriceSparkline eventId={event.id} currentPrice={event.outcomes.YES.price} />
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{formatVolume(event.volume)}</span>
          </div>
        </div>
        <FavoriteButton marketId={event.id} size="sm" />
      </div>
    </div>
  );
});
