import { Clock, Pause, HelpCircle, AlertTriangle, CheckCircle, Trophy } from 'lucide-react';
import { MarketStatus, MARKET_STATUS_LABELS, MarketOption } from '@/types/market';
import { formatCountdown, getStatusColor } from '@/hooks/useMarketStatus';
import { parseResult, PLACEMENT_LABELS } from '@/lib/resultParser';
import { cn } from '@/lib/utils';

interface MarketStatusBadgeProps {
  status: MarketStatus;
  timeToHalt?: number | null;
  timeToEvent?: number | null;
  contestTimeRemaining?: number | null;
  result?: string;  // Can be 'YES', 'NO', option id, or JSON array for multiple winners
  options?: MarketOption[];  // For multiple-choice markets to display winning option label
  size?: 'sm' | 'md' | 'lg';
  showCountdown?: boolean;
  isUrgent?: boolean;
}

export function MarketStatusBadge({
  status,
  timeToHalt,
  timeToEvent,
  contestTimeRemaining,
  result,
  options,
  size = 'sm',
  showCountdown = true,
  isUrgent = false,
}: MarketStatusBadgeProps) {
  const colors = getStatusColor(status);
  
  const getIcon = () => {
    switch (status) {
      case 'OPEN':
        return <Clock className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'HALTED':
        return <Pause className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'PENDING':
        return <HelpCircle className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'CONTESTED':
        return <AlertTriangle className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'SETTLED':
        return <CheckCircle className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />;
      default:
        return null;
    }
  };

  const getLabel = () => {
    if (status === 'SETTLED' && result) {
      const winners = parseResult(result);
      
      // Binary market
      if (winners[0] === 'YES') return 'Resultado: SIM';
      if (winners[0] === 'NO') return 'Resultado: NÃO';
      
      // Multiple-choice market - find winning option labels
      if (options && options.length > 0) {
        if (winners.length === 1) {
          const winningOption = options.find(opt => opt.id === winners[0]);
          if (winningOption) {
            return `Vencedor: ${winningOption.label}`;
          }
        } else {
          // Multiple winners - show abbreviated version
          const winnerLabels = winners
            .slice(0, 3)
            .map((id, index) => {
              const option = options.find(opt => opt.id === id);
              return option ? `${PLACEMENT_LABELS[index]} ${option.label}` : null;
            })
            .filter(Boolean);
          
          if (winnerLabels.length > 0) {
            return winnerLabels.join(' ');
          }
        }
      }
      
      return 'Encerrado';
    }
    return MARKET_STATUS_LABELS[status] || status;
  };

  const getCountdown = () => {
    if (!showCountdown) return null;
    
    switch (status) {
      case 'OPEN':
        if (timeToHalt && timeToHalt > 0) {
          return (
            <span className="text-xs opacity-80">
              · {formatCountdown(timeToHalt)} restantes
            </span>
          );
        }
        return null;
      case 'HALTED':
        if (timeToEvent && timeToEvent > 0) {
          return (
            <span className="text-xs opacity-80">
              · Resultado em {formatCountdown(timeToEvent)}
            </span>
          );
        }
        return null;
      case 'CONTESTED':
        if (contestTimeRemaining && contestTimeRemaining > 0) {
          return (
            <span className="text-xs opacity-80">
              · {formatCountdown(contestTimeRemaining)} restante
            </span>
          );
        }
        return null;
      default:
        return null;
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size],
        isUrgent && status === 'OPEN' && 'animate-pulse'
      )}
    >
      {getIcon()}
      <span>{getLabel()}</span>
      {getCountdown()}
    </div>
  );
}