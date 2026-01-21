import { memo, useState } from 'react';
import { TrendingUp, Plus, Lock } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketStatusBadge } from '@/components/market/MarketStatusBadge';
import { MarketTags } from '@/components/market/MarketTags';
import { PriceSparkline } from '@/components/market/PriceSparkline';
import { formatVolume, optimizeImageUrl } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-200 h-[260px] flex flex-col",
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
      <div className="flex items-start justify-between gap-3 min-h-[56px]">
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
                backgroundImage: `url(${optimizeImageUrl(event.imageUrl, { width: 96 })})`,
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
            className="flex-1 text-sm font-semibold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
            onClick={() => onViewDetails?.(event.id)}
          >
            {event.title}
          </h3>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "text-lg font-bold shrink-0 cursor-help",
              isSettled ? (resultIsYes ? "text-yes" : "text-no") : "text-primary"
            )}>
              {yesPrice}%
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Probabilidade de SIM acontecer</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Tags */}
      {event.tags && event.tags.length > 0 && (
        <div className="mt-2">
          <MarketTags tags={event.tags} maxTags={2} size="sm" />
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

      {/* Buttons - grows to fill space */}
      <div className="flex-1 flex flex-col justify-center my-3">
        {statusInfo.canTrade ? (
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 h-9 border-yes/40 text-yes hover:bg-yes/10 hover:border-yes font-medium"
                  onClick={() => onBuy(event.id, 'YES')}
                >
                  Sim
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Aposte que o evento vai acontecer</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 h-9 border-no/40 text-no hover:bg-no/10 hover:border-no font-medium"
                  onClick={() => onBuy(event.id, 'NO')}
                >
                  Não
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Aposte que o evento não vai acontecer</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className={cn(
              "flex-1 h-9 rounded-md flex items-center justify-center font-medium text-sm border",
              isSettled && resultIsYes 
                ? "bg-yes/10 text-yes border-yes/30" 
                : "bg-muted/50 text-muted-foreground border-border"
            )}>
              {isSettled ? (resultIsYes ? '✓ Sim' : 'Sim') : <Lock className="h-4 w-4" />}
            </div>
            <div className={cn(
              "flex-1 h-9 rounded-md flex items-center justify-center font-medium text-sm border",
              isSettled && !resultIsYes 
                ? "bg-no/10 text-no border-no/30" 
                : "bg-muted/50 text-muted-foreground border-border"
            )}>
              {isSettled ? (!resultIsYes ? '✓ Não' : 'Não') : <Lock className="h-4 w-4" />}
            </div>
          </div>
        )}

        {/* Payout info */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex justify-between text-xs text-muted-foreground mt-3 cursor-help">
              <span>R$1 → <span className="font-medium text-yes">R${(100 / yesPrice).toFixed(2)}</span></span>
              <span>R$1 → <span className="font-medium text-no">R${(100 / event.outcomes.NO.price).toFixed(2)}</span></span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>Se acertar, você recebe R$1,00 por contrato. O retorno depende do preço de compra.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Footer - always at bottom */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-help">
              <PriceSparkline eventId={event.id} currentPrice={yesPrice} />
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>{formatVolume(event.volume)}</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Tendência 7 dias • Volume total negociado</p>
          </TooltipContent>
        </Tooltip>
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
