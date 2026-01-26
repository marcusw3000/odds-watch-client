import { LucideIcon, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  previousValue?: number;
  changePercent?: number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  loading?: boolean;
  format?: 'number' | 'currency' | 'percent';
  tooltipPrevLabel?: string;
}

function formatValue(value: string | number, format: 'number' | 'currency' | 'percent' = 'number'): string {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString('pt-BR');
  }
}

function getChangeIndicator(changePercent: number | undefined) {
  if (changePercent === undefined || changePercent === 0) {
    return { icon: Minus, color: 'text-muted-foreground', bgColor: 'bg-muted' };
  }
  if (changePercent > 0) {
    return { icon: TrendingUp, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' };
  }
  return { icon: TrendingDown, color: 'text-red-600', bgColor: 'bg-red-500/10' };
}

export function MetricCard({
  label,
  value,
  previousValue,
  changePercent,
  icon: Icon,
  iconColor = 'text-primary',
  iconBgColor = 'bg-primary/10',
  loading = false,
  format = 'number',
  tooltipPrevLabel = 'Período anterior',
}: MetricCardProps) {
  const change = getChangeIndicator(changePercent);
  const ChangeIcon = change.icon;
  const showChange = changePercent !== undefined;

  const cardContent = (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-lg', iconBgColor)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <p className={cn(
                  'font-bold truncate',
                  format === 'currency' ? 'text-lg font-mono' : 'text-2xl'
                )}>
                  {formatValue(value, format)}
                </p>
                {showChange && (
                  <div className={cn(
                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium',
                    change.bgColor,
                    change.color
                  )}>
                    <ChangeIcon className="h-3 w-3" />
                    <span>{Math.abs(changePercent!).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (previousValue !== undefined && !loading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {tooltipPrevLabel}: {formatValue(previousValue, format)}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
