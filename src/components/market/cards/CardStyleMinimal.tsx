import { memo, useState } from 'react';
import { TrendingUp, Lock } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketTags } from '@/components/market/MarketTags';
import { RecurrenceLabel } from '@/components/market/RecurrenceLabel';
import { PriceSparkline } from '@/components/market/PriceSparkline';
import { formatVolume, optimizeImageUrl } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const statusColors = getStatusColor(statusInfo.status);

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
  
  // Get winning option label for multiple-choice markets
  const getWinnerLabel = () => {
    if (!event.result) return '';
    if (event.result === 'YES') return 'SIM ✓';
    if (event.result === 'NO') return 'NÃO ✓';
    if (event.options && event.options.length > 0) {
      const winningOption = event.options.find(opt => opt.id === event.result);
      if (winningOption) return `${winningOption.label} ✓`;
    }
    return 'Encerrado';
  };

  // Get status label for minimal display
  const getStatusLabel = () => {
    switch (statusInfo.status) {
      case 'HALTED': return 'Pausado';
      case 'PENDING': return 'Aguardando';
      case 'CONTESTED': return 'Contestação';
      case 'SETTLED': return getWinnerLabel();
      default: return '';
    }
  };

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-200 min-h-[280px] flex flex-col",
        "hover:scale-[1.01] hover:border-primary/30 hover:shadow-md"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status indicator border */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg transition-colors",
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

      {/* Status indicator */}
      <div className={cn(
        "mt-2 px-2 py-1 rounded text-xs font-medium w-fit",
        statusColors.bg,
        statusColors.text
      )}>
        {!isSettled && !statusInfo.canTrade && <Lock className="h-3 w-3 inline mr-1" />}
        {getStatusLabel() || (statusInfo.canTrade ? 'Aberto' : 'Fechado')}
      </div>

      {/* Trading buttons - centered and grows to fill */}
      <div className="flex-1 flex flex-col justify-center my-3">
        {statusInfo.canTrade ? (
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  onClick={() => onBuy(event.id, 'YES')}
                >
                  SIM {yesPrice}¢
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Comprar SIM</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  onClick={() => onBuy(event.id, 'NO')}
                >
                  NÃO {noPrice}¢
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Comprar NÃO</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className={cn(
              "flex-1 h-10 rounded-md flex items-center justify-center font-bold text-sm",
              isSettled && event.result === 'YES' 
                ? "bg-yes/20 text-yes border border-yes/30" 
                : "bg-muted text-muted-foreground"
            )}>
              {isSettled ? (event.result === 'YES' ? '✓ SIM' : 'SIM') : <Lock className="h-4 w-4" />}
            </div>
            <div className={cn(
              "flex-1 h-10 rounded-md flex items-center justify-center font-bold text-sm",
              isSettled && event.result === 'NO' 
                ? "bg-no/20 text-no border border-no/30" 
                : "bg-muted text-muted-foreground"
            )}>
              {isSettled ? (event.result === 'NO' ? '✓ NÃO' : 'NÃO') : <Lock className="h-4 w-4" />}
            </div>
          </div>
        )}
      </div>

      {/* Footer - always at bottom */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PriceSparkline eventId={event.id} currentPrice={yesPrice} />
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{formatVolume(event.volume)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
