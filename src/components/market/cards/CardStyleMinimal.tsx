import { memo, useState, useMemo } from 'react';
import { TrendingUp, Lock, ChevronRight } from 'lucide-react';
import { FavoriteButton } from '@/components/market/FavoriteButton';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketStatusBadge } from '@/components/market/MarketStatusBadge';
import { RecurrenceLabel } from '@/components/market/RecurrenceLabel';
import { PriceSparkline } from '@/components/market/PriceSparkline';
import { formatVolume, optimizeImageUrl } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { gridClasses, getCategoryIcon, OptionRow, LeaderOptionRow } from './CardGridLayout';

interface CardStyleMinimalProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
  onMouseEnter?: () => void;
}

export const CardStyleMinimal = memo(function CardStyleMinimal({
  event,
  onBuy,
  onViewDetails,
  onMouseEnter,
}: CardStyleMinimalProps) {
  const statusInfo = useMarketStatus(event);
  const [isHovered, setIsHovered] = useState(false);
  const statusColors = getStatusColor(statusInfo.status);

  const hasImage = Boolean(event.imageUrl);
  const yesPrice = event.outcomes.YES.price;
  const noPrice = event.outcomes.NO.price;
  const isSettled = statusInfo.status === 'SETTLED';
  const resultIsYes = event.result === 'YES';
  const isMultiple = event.marketType === 'MULTIPLE';

  // For multi-option markets, find the leader option
  const leaderOption = useMemo(() => {
    if (!isMultiple || !event.options?.length) return null;
    return [...event.options].sort((a, b) => b.currentPrice - a.currentPrice)[0];
  }, [isMultiple, event.options]);

  const leaderIsWinner = isSettled && leaderOption && event.result === leaderOption.id;

  return (
    <div 
      className={cn(gridClasses.container, "group")}
      onMouseEnter={() => {
        setIsHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status indicator border */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg transition-colors",
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
                backgroundPosition: 'center',
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-lg">
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
        {isMultiple && leaderOption ? (
          <LeaderOptionRow 
            option={leaderOption} 
            totalOptions={event.options!.length}
            isSettled={isSettled}
            isWinner={leaderIsWinner}
          />
        ) : (
          <>
            <OptionRow 
              label="Sim" 
              price={yesPrice} 
              isWinner={isSettled && resultIsYes}
              variant="yes"
            />
            <OptionRow 
              label="Não" 
              price={noPrice} 
              isWinner={isSettled && !resultIsYes}
              variant="no"
            />
          </>
        )}
      </div>

      {/* Zone 4: Buttons */}
      <div className={gridClasses.buttons}>
        {isMultiple ? (
          <Button
            className="w-full h-10 font-bold"
            variant="outline"
            onClick={() => onViewDetails?.(event.id)}
          >
            Ver {event.options?.length || 0} opções
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : statusInfo.canTrade ? (
          <>
            <Button
              className="flex-1 h-10 bg-yes hover:bg-yes/90 text-yes-foreground font-bold"
              onClick={() => onBuy(event.id, 'YES')}
            >
              SIM {yesPrice}¢
            </Button>
            <Button
              className="flex-1 h-10 bg-no hover:bg-no/90 text-no-foreground font-bold"
              onClick={() => onBuy(event.id, 'NO')}
            >
              NÃO {noPrice}¢
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
          <PriceSparkline eventId={event.id} currentPrice={yesPrice} />
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
