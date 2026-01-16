import { useState, memo } from 'react';
import { TrendingUp, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { OddsBadge } from './OddsBadge';
import { MarketStatusBadge } from './MarketStatusBadge';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { formatVolume } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface MarketCardProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
}

export const MarketCard = memo(function MarketCard({ event, onBuy, onViewDetails }: MarketCardProps) {
  const [hoveredOutcome, setHoveredOutcome] = useState<'YES' | 'NO' | null>(null);
  const statusInfo = useMarketStatus(event);

  // formatVolume is now imported from @/lib/formatters

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Economia: 'bg-primary/20 text-primary',
      Câmbio: 'bg-warning/20 text-warning',
      Esportes: 'bg-success/20 text-success',
      Mercado: 'bg-purple-500/20 text-purple-400',
      Política: 'bg-red-500/20 text-red-400',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-card transition-colors duration-200 hover:border-primary/30">
      {/* Header */}
      <div className="p-5 pb-4">
        {/* Tags Row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium', getCategoryColor(event.category))}>
            {event.category}
          </span>
          {event.marketType === 'MULTIPLE' && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-accent text-accent-foreground">
              Múltiplas opções
            </span>
          )}
          {statusInfo.isUrgent && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-destructive/20 text-destructive animate-pulse">
              Urgente
            </span>
          )}
          {event.volume && event.volume >= 50000 && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-success/20 text-success">
              Popular
            </span>
          )}
        </div>
        
        {/* Status Badge */}
        <div className="flex justify-end mb-2">
          <MarketStatusBadge
            status={statusInfo.status}
            timeToHalt={statusInfo.timeToHalt}
            result={event.result}
            size="sm"
            showCountdown={statusInfo.isUrgent}
            isUrgent={statusInfo.isUrgent}
          />
        </div>

        <h3 className="text-lg font-semibold leading-snug mb-4 group-hover:text-primary transition-colors">
          {event.title}
        </h3>

        {/* Odds Display */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Sim</p>
            <OddsBadge
              type="YES"
              price={event.outcomes.YES.price}
              probability={event.outcomes.YES.probability}
              size="lg"
            />
          </div>
          <div className="h-12 w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Não</p>
            <OddsBadge
              type="NO"
              price={event.outcomes.NO.price}
              probability={event.outcomes.NO.probability}
              size="lg"
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Vol: {formatVolume(event.volume)}</span>
          </div>
          <span>
            Atualizado: {format(event.lastUpdatedAt, 'HH:mm', { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* View Details Button */}
      {onViewDetails && (
        <button
          className="w-full py-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors flex items-center justify-center gap-1 border-t border-border"
          onClick={() => onViewDetails(event.id)}
        >
          Ver detalhes
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Action Buttons */}
      <div className={cn(
        "grid grid-cols-2 gap-0 border-t border-border",
        !statusInfo.canTrade && "opacity-50 pointer-events-none"
      )}>
        <Button
          variant="ghost"
          className={cn(
            "h-14 rounded-none border-r border-border font-semibold transition-all",
            hoveredOutcome === 'YES' && "bg-yes-muted text-yes"
          )}
          onMouseEnter={() => setHoveredOutcome('YES')}
          onMouseLeave={() => setHoveredOutcome(null)}
          onClick={() => onBuy(event.id, 'YES')}
          disabled={!statusInfo.canTrade}
        >
          <span className="text-yes mr-2">●</span>
          Comprar SIM
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "h-14 rounded-none font-semibold transition-all",
            hoveredOutcome === 'NO' && "bg-no-muted text-no"
          )}
          onMouseEnter={() => setHoveredOutcome('NO')}
          onMouseLeave={() => setHoveredOutcome(null)}
          onClick={() => onBuy(event.id, 'NO')}
          disabled={!statusInfo.canTrade}
        >
          <span className="text-no mr-2">●</span>
          Comprar NÃO
        </Button>
      </div>
    </div>
  );
});
