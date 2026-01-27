import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { usePriceHistoryContext, PriceHistoryPoint } from '@/hooks/usePriceHistoryBatch';

interface PriceSparklineProps {
  eventId: string;
  currentPrice: number;
  className?: string;
  width?: number;
  height?: number;
  /** Optional direct data - if provided, skips context lookup */
  historyData?: PriceHistoryPoint[];
}

export const PriceSparkline = memo(function PriceSparkline({
  eventId,
  currentPrice,
  className,
  width = 48,
  height = 18,
  historyData: directData,
}: PriceSparklineProps) {
  // Get data from context if not passed directly
  const contextData = usePriceHistoryContext();
  const historyData = directData || contextData?.[eventId] || [];

  const { points, isUp } = useMemo(() => {
    // Use real data if available, otherwise generate deterministic fallback
    let data: number[];
    
    if (historyData.length >= 2) {
      // Use real price history
      data = historyData.map(p => Number(p.yes_price) * 100);
    } else {
      // Fallback: Generate deterministic data based on eventId
      const seed = eventId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const random = (i: number) => {
        const x = Math.sin(seed + i) * 10000;
        return x - Math.floor(x);
      };
      
      // Generate 7 points (7-day trend)
      data = Array.from({ length: 7 }, (_, i) => {
        // Trend towards current price
        const progress = i / 6;
        const baseValue = 50 + (currentPrice - 50) * progress;
        const noise = (random(i) - 0.5) * 15;
        return Math.max(5, Math.min(95, baseValue + noise));
      });
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;

    const pathPoints = data.map((value, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    return {
      points: pathPoints,
      isUp: data[data.length - 1] > data[0],
    };
  }, [eventId, currentPrice, width, height, historyData]);

  return (
    <svg 
      width={width} 
      height={height} 
      className={cn("flex-shrink-0", className)}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? 'hsl(var(--yes))' : 'hsl(var(--no))'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

