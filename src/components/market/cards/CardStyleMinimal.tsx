import { memo, useState } from 'react';
import { TrendingUp, Lock } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketTags } from '@/components/market/MarketTags';
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
        "group relative overflow-hidden rounded-lg border border-border bg-card p-3 transition-all duration-200",
        "hover:border-primary/30 hover:shadow-sm"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status indicator border */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg transition-colors",
        statusColors.bg
      )} />

      {/* Compact layout */}
      <div className="flex items-center gap-3">
        {/* Image */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full overflow-hidden relative bg-secondary",
          !statusInfo.canTrade && "grayscale"
        )}>
          {hasImage ? (
            <div 
              className="absolute inset-0 bg-cover"
              style={{
                backgroundImage: `url(${optimizeImageUrl(event.imageUrl, { width: 64 })})`,
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

        {/* Compact buttons or status */}
        <div className="flex items-center gap-1.5 shrink-0">
          {statusInfo.canTrade ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 px-2.5 bg-yes/20 hover:bg-yes/30 text-yes border-0 text-xs font-bold"
                    onClick={() => onBuy(event.id, 'YES')}
                  >
                    {yesPrice}¢
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Comprar SIM</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 px-2.5 bg-no/20 hover:bg-no/30 text-no border-0 text-xs font-bold"
                    onClick={() => onBuy(event.id, 'NO')}
                  >
                    {noPrice}¢
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Comprar NÃO</p>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
              statusColors.bg,
              statusColors.text
            )}>
              {!isSettled && <Lock className="h-3 w-3" />}
              <span>{getStatusLabel()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tags, Sparkline and Volume - subtle */}
      <div className="flex items-center gap-2 mt-2 pl-11">
        {event.tags && event.tags.length > 0 && (
          <MarketTags tags={event.tags} maxTags={2} size="sm" />
        )}
        <div className="flex items-center gap-2 ml-auto">
          <PriceSparkline eventId={event.id} currentPrice={yesPrice} width={40} height={14} />
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-help">
                <TrendingUp className="h-2.5 w-2.5" />
                <span>{formatVolume(event.volume)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Volume negociado</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
