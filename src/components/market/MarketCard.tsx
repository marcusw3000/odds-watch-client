import { useState } from 'react';
import { Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { OddsBadge } from './OddsBadge';
import { cn } from '@/lib/utils';

interface MarketCardProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
}

export function MarketCard({ event, onBuy, onViewDetails }: MarketCardProps) {
  const [hoveredOutcome, setHoveredOutcome] = useState<'YES' | 'NO' | null>(null);

  const formatVolume = (vol?: number) => {
    if (!vol) return 'R$0';
    if (vol >= 1000000) return `R$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `R$${(vol / 1000).toFixed(0)}k`;
    return `R$${vol}`;
  };

  const timeUntilExpiry = formatDistanceToNow(event.expiryAt, {
    locale: ptBR,
    addSuffix: true,
  });

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
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:border-primary/30 hover:shadow-elevated">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <span className={cn('px-2.5 py-1 rounded-md text-xs font-medium', getCategoryColor(event.category))}>
            {event.category}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{timeUntilExpiry}</span>
          </div>
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

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-0 border-t border-border">
        <Button
          variant="ghost"
          className={cn(
            "h-14 rounded-none border-r border-border font-semibold transition-all",
            hoveredOutcome === 'YES' && "bg-yes-muted text-yes"
          )}
          onMouseEnter={() => setHoveredOutcome('YES')}
          onMouseLeave={() => setHoveredOutcome(null)}
          onClick={() => onBuy(event.id, 'YES')}
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
        >
          <span className="text-no mr-2">●</span>
          Comprar NÃO
        </Button>
      </div>

      {/* View Details Link */}
      {onViewDetails && (
        <button
          className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onViewDetails(event.id)}
        >
          <ChevronRight className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  );
}
