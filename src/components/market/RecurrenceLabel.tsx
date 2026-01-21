import { memo } from 'react';
import { Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type RecurrenceType = 'none' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: '',
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  annually: 'Anual',
};

export const RECURRENCE_DESCRIPTIONS: Record<RecurrenceType, string> = {
  none: '',
  weekly: 'Este mercado se repete toda semana',
  monthly: 'Este mercado se repete todo mês',
  quarterly: 'Este mercado se repete a cada trimestre',
  annually: 'Este mercado se repete todo ano',
};

interface RecurrenceLabelProps {
  type: RecurrenceType;
  size?: 'sm' | 'default';
  className?: string;
}

export const RecurrenceLabel = memo(function RecurrenceLabel({ 
  type, 
  size = 'sm', 
  className 
}: RecurrenceLabelProps) {
  if (type === 'none' || !type) return null;

  const label = RECURRENCE_LABELS[type];
  const description = RECURRENCE_DESCRIPTIONS[type];
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'gap-1 font-normal border-primary/30 text-primary bg-primary/5 cursor-help',
            size === 'sm' && 'text-[10px] px-1.5 py-0 h-4',
            size === 'default' && 'text-xs px-2 py-0.5',
            className
          )}
        >
          <Repeat className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  );
});
