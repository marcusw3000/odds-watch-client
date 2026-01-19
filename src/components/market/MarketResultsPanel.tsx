import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, XCircle, Trophy, TrendingUp, Calendar } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface MarketResultsPanelProps {
  event: MarketEvent;
}

export function MarketResultsPanel({ event }: MarketResultsPanelProps) {
  const isMultiple = event.marketType === 'MULTIPLE' && event.options && event.options.length > 0;
  const result = event.result;

  const formatVolume = (volume?: number) => {
    if (!volume) return 'R$0';
    if (volume >= 1000000) return `R$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `R$${(volume / 1000).toFixed(1)}K`;
    return formatCurrency(volume);
  };

  const settlementDate = event.settledAt || event.lastUpdatedAt;

  if (isMultiple) {
    // Multiple choice market
    const winningOption = event.options?.find(opt => opt.id === result);
    const losingOptions = event.options?.filter(opt => opt.id !== result) || [];

    return (
      <div className="space-y-4">
        {/* Winning Option */}
        {winningOption && (
          <div className="p-4 rounded-lg bg-yes-muted/30 border-2 border-yes">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-yes" />
              <span className="text-sm font-medium text-yes">Opção Vencedora</span>
            </div>
            <div className="flex items-center gap-3">
              {winningOption.imageUrl && (
                <img
                  src={winningOption.imageUrl}
                  alt={winningOption.label}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <p className="font-semibold text-lg">{winningOption.label}</p>
                {winningOption.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {winningOption.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-yes font-bold">
                <CheckCircle className="h-5 w-5" />
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* Losing Options */}
        {losingOptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Outras opções
            </p>
            {losingOptions.map(option => (
              <div
                key={option.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 opacity-60"
              >
                {option.imageUrl && (
                  <img
                    src={option.imageUrl}
                    alt={option.label}
                    className="w-8 h-8 rounded object-cover grayscale"
                  />
                )}
                <span className="flex-1 text-sm">{option.label}</span>
                <span className="text-sm text-muted-foreground">0%</span>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Volume total
            </span>
            <span className="font-mono font-semibold">{formatVolume(event.volume)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Liquidado em
            </span>
            <span className="font-medium">
              {format(settlementDate, "dd MMM 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>

        {/* Payout Info */}
        <div className="p-3 rounded-lg bg-secondary text-sm text-center">
          <p className="text-muted-foreground">
            Contratos vencedores pagaram{' '}
            <span className="font-semibold text-foreground">
              R${event.contractUnitCost.toFixed(2)}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // Binary market (YES/NO)
  const isYesWinner = result === 'YES';
  const isNoWinner = result === 'NO';

  return (
    <div className="space-y-4">
      {/* YES Result */}
      <div
        className={cn(
          'p-4 rounded-lg border-2 transition-all',
          isYesWinner
            ? 'bg-yes-muted/30 border-yes'
            : 'bg-muted/50 border-transparent opacity-60'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isYesWinner ? (
              <CheckCircle className="h-8 w-8 text-yes" />
            ) : (
              <XCircle className="h-8 w-8 text-muted-foreground" />
            )}
            <div>
              <p className={cn('font-bold text-xl', isYesWinner && 'text-yes')}>
                SIM
              </p>
              <p className="text-sm text-muted-foreground">
                {isYesWinner ? 'Resultado final' : 'Não aconteceu'}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'text-2xl font-bold',
              isYesWinner ? 'text-yes' : 'text-muted-foreground'
            )}
          >
            {isYesWinner ? '100%' : '0%'}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">vs</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* NO Result */}
      <div
        className={cn(
          'p-4 rounded-lg border-2 transition-all',
          isNoWinner
            ? 'bg-no-muted/30 border-no'
            : 'bg-muted/50 border-transparent opacity-60'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isNoWinner ? (
              <CheckCircle className="h-8 w-8 text-no" />
            ) : (
              <XCircle className="h-8 w-8 text-muted-foreground" />
            )}
            <div>
              <p className={cn('font-bold text-xl', isNoWinner && 'text-no')}>
                NÃO
              </p>
              <p className="text-sm text-muted-foreground">
                {isNoWinner ? 'Resultado final' : 'Não aconteceu'}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'text-2xl font-bold',
              isNoWinner ? 'text-no' : 'text-muted-foreground'
            )}
          >
            {isNoWinner ? '100%' : '0%'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="pt-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Volume total
          </span>
          <span className="font-mono font-semibold">{formatVolume(event.volume)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Liquidado em
          </span>
          <span className="font-medium">
            {format(settlementDate, "dd MMM 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* Payout Info */}
      <div className="p-3 rounded-lg bg-secondary text-sm text-center">
        <p className="text-muted-foreground">
          Contratos vencedores pagaram{' '}
          <span className="font-semibold text-foreground">
            R${event.contractUnitCost.toFixed(2)}
          </span>
        </p>
      </div>
    </div>
  );
}
