import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SlippageSelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const SLIPPAGE_OPTIONS = [
  { value: 0.01, label: '1%', description: 'Rigoroso' },
  { value: 0.02, label: '2%', description: 'Conservador' },
  { value: 0.05, label: '5%', description: 'Padrão' },
  { value: 0.10, label: '10%', description: 'Flexível' },
];

export function SlippageSelector({ value, onChange, disabled }: SlippageSelectorProps) {
  const selectedOption = SLIPPAGE_OPTIONS.find(opt => opt.value === value) || SLIPPAGE_OPTIONS[2];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Tolerância: {selectedOption.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 pb-1">
            Tolerância de Slippage
          </p>
          {SLIPPAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                value === option.value 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              )}
            >
              <span className="font-mono font-medium">{option.label}</span>
              <span className={cn(
                "text-xs",
                value === option.value ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                {option.description}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 px-2">
          Define a variação máxima de preço aceita entre a cotação e a execução.
        </p>
      </PopoverContent>
    </Popover>
  );
}
