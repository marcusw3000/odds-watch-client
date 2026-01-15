import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface OddsBadgeProps {
  type: 'YES' | 'NO';
  price: number;
  probability: number;
  size?: 'sm' | 'md' | 'lg';
  showProbability?: boolean;
  animated?: boolean;
}

export const OddsBadge = memo(forwardRef<HTMLDivElement, OddsBadgeProps>(
  function OddsBadge({
    type,
    price,
    probability,
    size = 'md',
    showProbability = true,
    animated = false,
  }, ref) {
    const isYes = type === 'YES';

    const sizeClasses = {
      sm: 'text-sm px-2 py-1',
      md: 'text-base px-3 py-1.5',
      lg: 'text-lg px-4 py-2',
    };

    const priceFormatted = `R$${(price / 100).toFixed(2)}`;

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex flex-col items-center rounded-lg font-mono transition-opacity duration-150',
          isYes ? 'bg-yes-muted border border-yes/30' : 'bg-no-muted border border-no/30',
          sizeClasses[size],
          animated && 'animate-number-tick'
        )}
      >
        <span
          className={cn(
            'font-bold',
            isYes ? 'text-yes' : 'text-no',
            size === 'lg' && 'text-xl'
          )}
        >
          {priceFormatted}
        </span>
        {showProbability && (
          <span className="text-xs text-muted-foreground">
            {probability}%
          </span>
        )}
      </div>
    );
  }
));
