import { memo, useState } from 'react';
import { TrendingUp, Lock, ChevronRight } from 'lucide-react';
import { MarketEvent, MarketOption } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus, getStatusColor } from '@/hooks/useMarketStatus';
import { MarketStatusBadge } from '@/components/market/MarketStatusBadge';
import { MarketTags } from '@/components/market/MarketTags';
import { FavoriteButton } from '@/components/market/FavoriteButton';
import { formatVolume, optimizeImageUrl } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

interface MultiOptionCardProps {
  event: MarketEvent;
  onBuyOption: (eventId: string, optionId: string) => void;
  onViewDetails?: (eventId: string) => void;
}

export const MultiOptionCard = memo(function MultiOptionCard({
  event,
  onBuyOption,
  onViewDetails,
}: MultiOptionCardProps) {
  const statusInfo = useMarketStatus(event);
  const [isHovered, setIsHovered] = useState(false);
  const statusColors = getStatusColor(statusInfo.status);

  const options = event.options || [];
  const sortedOptions = [...options].sort((a, b) => b.currentPrice - a.currentPrice);
  const topOptions = sortedOptions.slice(0, 4);
  const hasMoreOptions = options.length > 4;

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
  const isSettled = statusInfo.status === 'SETTLED';
  const winningOptionId = event.result;

  // Color palette for options
  const optionColors = [
    'bg-primary/20 text-primary border-primary/30',
    'bg-accent/20 text-accent-foreground border-accent/30',
    'bg-warning/20 text-warning border-warning/30',
    'bg-destructive/20 text-destructive border-destructive/30',
    'bg-success/20 text-success border-success/30',
  ];

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
        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors",
        statusColors.bg
      )} />

      {/* Badge for multiple options */}
      <div className="absolute top-2 right-2">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent text-accent-foreground">
          {options.length} opções
        </span>
      </div>

      {/* Header with image and title */}
      <div className="flex items-start gap-3 min-h-[48px] pr-16">
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

      {/* Options list */}
      <div className="flex-1 space-y-2 my-3">
        {topOptions.map((option, index) => {
          const isWinner = isSettled && winningOptionId === option.id;
          const colorClass = optionColors[index % optionColors.length];
          
          return (
            <div 
              key={option.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border transition-all",
                isWinner ? "bg-yes/10 border-yes/30" : "border-border hover:border-primary/30"
              )}
            >
              {/* Option image or color indicator */}
              {option.imageUrl ? (
                <div 
                  className="w-6 h-6 rounded-full bg-cover bg-center shrink-0"
                  style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, { width: 48 })})` }}
                />
              ) : (
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  colorClass
                )}>
                  {option.label.charAt(0)}
                </div>
              )}

              {/* Option label and price bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    "text-xs font-medium truncate",
                    isWinner && "text-yes"
                  )}>
                    {option.label}
                    {isWinner && " ✓"}
                  </span>
                  <span className={cn(
                    "text-xs font-bold shrink-0",
                    isWinner ? "text-yes" : "text-muted-foreground"
                  )}>
                    {option.currentPrice}%
                  </span>
                </div>
                <Progress 
                  value={option.currentPrice} 
                  className="h-1 mt-1"
                />
              </div>

              {/* Buy button */}
              {statusInfo.canTrade && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] font-medium hover:bg-primary/10 hover:text-primary shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBuyOption(event.id, option.id);
                      }}
                    >
                      {option.currentPrice}¢
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Comprar {option.label}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {!statusInfo.canTrade && !isWinner && (
                <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}

        {/* Show more options indicator */}
        {hasMoreOptions && (
          <button
            className="w-full text-xs text-muted-foreground hover:text-primary py-1 transition-colors flex items-center justify-center gap-1"
            onClick={() => onViewDetails?.(event.id)}
          >
            +{options.length - 4} mais opções
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
              <TrendingUp className="h-3 w-3" />
              <span>{formatVolume(event.volume)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Volume total negociado</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-1">
          <FavoriteButton marketId={event.id} size="sm" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onViewDetails?.(event.id)}
          >
            Ver detalhes
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
});
