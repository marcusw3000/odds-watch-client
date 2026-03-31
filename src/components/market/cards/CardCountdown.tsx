import { Timer } from 'lucide-react';
import { MarketStatusInfo, formatCountdown } from '@/hooks/useMarketStatus';
import { cn } from '@/lib/utils';

interface CardCountdownProps {
  statusInfo: MarketStatusInfo;
}

export function CardCountdown({ statusInfo }: CardCountdownProps) {
  const { status, timeToHalt, timeToEvent, contestTimeRemaining, isUrgent } = statusInfo;

  // Determine which countdown to show
  let seconds: number | null = null;
  let colorClass = 'text-muted-foreground';

  switch (status) {
    case 'OPEN':
      seconds = timeToHalt;
      colorClass = 'text-success';
      break;
    case 'HALTED':
      seconds = timeToEvent;
      colorClass = 'text-warning';
      break;
    case 'CONTESTED':
      seconds = contestTimeRemaining;
      colorClass = 'text-warning';
      break;
    case 'PENDING':
      return null;
    case 'SETTLED':
      return null;
    default:
      return null;
  }

  if (seconds === null || seconds <= 0) return null;

  return (
    <div className={cn(
      "flex items-center gap-1 text-xs ml-auto",
      colorClass,
      isUrgent && "animate-pulse font-semibold"
    )}>
      <Timer className="h-3 w-3" />
      <span className="font-mono tabular-nums">{formatCountdown(seconds)}</span>
    </div>
  );
}
