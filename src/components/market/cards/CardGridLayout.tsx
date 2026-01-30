import { cn } from '@/lib/utils';
import { MarketOption } from '@/types/market';
import { Trophy } from 'lucide-react';
import { parseResult, getOptionPlacement, PLACEMENT_LABELS } from '@/lib/resultParser';

// Grid structure constants for market cards
export const CARD_GRID = {
  minHeight: 280,
  zones: {
    header: 56,
    status: 32,
    options: 48,
    buttons: 48,
    footer: 40,
  },
} as const;

// Reusable grid CSS classes
export const gridClasses = {
  container: "grid grid-rows-[auto_32px_48px_48px_40px] min-h-[280px] p-4 rounded-xl border border-border bg-card overflow-hidden relative transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:scale-[1.01]",
  header: "flex items-start gap-3",
  status: "flex items-center gap-2",
  options: "flex flex-col justify-center gap-1",
  buttons: "flex items-center gap-2",
  footer: "flex items-center justify-between pt-2 border-t border-border",
};

// Category icons mapping
export const getCategoryIcon = (category: string): string => {
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

// Option row component for displaying YES/NO prices
interface OptionRowProps {
  label: string;
  price: number;
  isWinner?: boolean;
  variant: 'yes' | 'no';
}

export function OptionRow({ label, price, isWinner, variant }: OptionRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(
        "text-xs text-muted-foreground",
        isWinner && (variant === 'yes' ? "text-yes font-medium" : "text-no font-medium")
      )}>
        {label}
      </span>
      <span className={cn(
        "text-sm font-bold tabular-nums text-muted-foreground",
        isWinner && (variant === 'yes' ? "text-yes" : "text-no")
      )}>
        {price}%
      </span>
    </div>
  );
}

// Leader option row for multi-option markets on homepage
interface LeaderOptionRowProps {
  option: MarketOption;
  totalOptions: number;
  isSettled?: boolean;
  isWinner?: boolean;
  result?: string;  // Pass result to check for placement
}

export function LeaderOptionRow({ option, totalOptions, isSettled, isWinner, result }: LeaderOptionRowProps) {
  const othersCount = totalOptions - 1;
  
  // Get placement badge if this option placed
  const placement = result ? getOptionPlacement(option.id, result) : null;
  const placementBadge = placement ? PLACEMENT_LABELS[placement - 1] : null;
  
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {placementBadge ? (
            <span className="text-sm">{placementBadge}</span>
          ) : (
            <Trophy className={cn(
              "h-3.5 w-3.5 flex-shrink-0",
              isWinner ? "text-yes" : "text-amber-500"
            )} />
          )}
          <span className={cn(
            "text-xs font-medium truncate",
            isWinner && "text-yes"
          )}>
            {option.label}
          </span>
          {isWinner && !placementBadge && (
            <span className="text-yes text-[10px]">✓</span>
          )}
        </div>
        <span className={cn(
          "text-sm font-bold tabular-nums",
          isWinner ? "text-yes" : "text-primary"
        )}>
          {option.currentPrice}%
        </span>
      </div>
      {othersCount > 0 && !isSettled && (
        <span className="text-[10px] text-muted-foreground">
          +{othersCount} {othersCount === 1 ? 'outra opção' : 'outras opções'}
        </span>
      )}
    </div>
  );
}
