import { cn } from '@/lib/utils';

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
