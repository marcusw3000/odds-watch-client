import { memo } from 'react';
import { TrendingUp, Clock, Timer, Percent, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MarketFilters } from '@/hooks/useMarketFilters';

interface QuickSortProps {
  sortBy: MarketFilters['sortBy'];
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: MarketFilters['sortBy'], order: 'asc' | 'desc') => void;
  className?: string;
}

const sortOptions = [
  { value: 'volume' as const, label: 'Volume', icon: TrendingUp },
  { value: 'created' as const, label: 'Recentes', icon: Clock },
  { value: 'closing' as const, label: 'Fechando', icon: Timer },
  { value: 'probability' as const, label: 'Probabilidade', icon: Percent },
];

export const QuickSort = memo(function QuickSort({
  sortBy,
  sortOrder,
  onSortChange,
  className,
}: QuickSortProps) {
  const toggleSort = (value: MarketFilters['sortBy']) => {
    if (sortBy === value) {
      // Toggle order if same sort
      onSortChange(value, sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      // Default to desc for new sort
      onSortChange(value, 'desc');
    }
  };

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Ordenar:</span>
      {sortOptions.map(({ value, label, icon: Icon }) => {
        const isActive = sortBy === value;
        return (
          <Button
            key={value}
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              "h-7 px-2 text-xs gap-1",
              isActive && "bg-secondary"
            )}
            onClick={() => toggleSort(value)}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
            {isActive && (
              sortOrder === 'desc' 
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronUp className="h-3 w-3" />
            )}
          </Button>
        );
      })}
    </div>
  );
});
