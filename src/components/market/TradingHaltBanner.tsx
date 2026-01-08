import { AlertTriangle, Clock, Lock, HelpCircle, CheckCircle } from 'lucide-react';
import { MarketStatus } from '@/types/market';
import { formatCountdown, getStatusColor } from '@/hooks/useMarketStatus';
import { cn } from '@/lib/utils';

interface TradingHaltBannerProps {
  status: MarketStatus;
  timeToHalt?: number | null;
  timeToEvent?: number | null;
  contestTimeRemaining?: number | null;
  result?: 'YES' | 'NO';
  isUrgent?: boolean;
}

export function TradingHaltBanner({
  status,
  timeToHalt,
  timeToEvent,
  contestTimeRemaining,
  result,
  isUrgent = false,
}: TradingHaltBannerProps) {
  // Don't show banner for OPEN status unless urgent
  if (status === 'OPEN' && !isUrgent) return null;

  const colors = getStatusColor(status);

  const getContent = () => {
    if (status === 'OPEN' && isUrgent) {
      return {
        icon: <AlertTriangle className="h-5 w-5" />,
        title: 'Negociações serão pausadas em breve',
        description: timeToHalt ? `Último momento para comprar/vender. Tempo restante: ${formatCountdown(timeToHalt)}` : 'Prepare-se para o fechamento.',
      };
    }

    switch (status) {
      case 'HALTED':
        return {
          icon: <Lock className="h-5 w-5" />,
          title: 'Negociações pausadas',
          description: timeToEvent 
            ? `Aguardando o evento acontecer. Tempo: ${formatCountdown(timeToEvent)}`
            : 'Mercado temporariamente fechado para negociações.',
        };
      case 'PENDING':
        return {
          icon: <HelpCircle className="h-5 w-5" />,
          title: 'Aguardando resultado oficial',
          description: 'O evento já ocorreu. Estamos aguardando a confirmação do resultado pela fonte oficial.',
        };
      case 'CONTESTED':
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          title: 'Período de contestação ativo',
          description: contestTimeRemaining 
            ? `Usuários podem contestar o resultado. Encerra em: ${formatCountdown(contestTimeRemaining)}`
            : 'Período para contestações abertas.',
        };
      case 'SETTLED':
        return {
          icon: <CheckCircle className="h-5 w-5" />,
          title: 'Mercado liquidado',
          description: result 
            ? `Resultado oficial: ${result === 'YES' ? 'SIM' : 'NÃO'}. Pagamentos realizados.`
            : 'Este mercado foi encerrado e os pagamentos foram processados.',
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        colors.bg,
        colors.border,
        isUrgent && 'animate-pulse'
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', colors.text)}>
        {content.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={cn('font-semibold text-sm', colors.text)}>
          {content.title}
        </h4>
        <p className="text-sm text-muted-foreground mt-0.5">
          {content.description}
        </p>
      </div>
      {(status === 'OPEN' || status === 'HALTED') && timeToHalt && timeToHalt > 0 && (
        <div className={cn('flex items-center gap-1.5 flex-shrink-0', colors.text)}>
          <Clock className="h-4 w-4" />
          <span className="font-mono font-bold text-lg">
            {formatCountdown(status === 'OPEN' ? timeToHalt : timeToEvent)}
          </span>
        </div>
      )}
    </div>
  );
}