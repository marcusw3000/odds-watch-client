import { memo } from 'react';
import { Lock, TrendingUp } from 'lucide-react';
import { MarketEvent, MarketOption } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MultiOptionTradingPanelProps {
  event: MarketEvent;
  canTrade: boolean;
  onBuyOption: (option: MarketOption) => void;
}

export const MultiOptionTradingPanel = memo(function MultiOptionTradingPanel({
  event,
  canTrade,
  onBuyOption,
}: MultiOptionTradingPanelProps) {
  const options = event.options || [];
  const sortedOptions = [...options].sort((a, b) => b.currentPrice - a.currentPrice);
  const isSettled = event.status === 'SETTLED';
  const winningOptionId = event.result;

  // Color palette for options
  const optionColors = [
    { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary' },
    { bg: 'bg-accent/10', border: 'border-accent/30', text: 'text-accent-foreground' },
    { bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning' },
    { bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive' },
    { bg: 'bg-success/10', border: 'border-success/30', text: 'text-success' },
    { bg: 'bg-muted', border: 'border-border', text: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {options.length} opções disponíveis
        </span>
        {event.optionsExclusive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">
                Exclusivo (1 vencedor)
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Apenas uma opção pode vencer. Soma das probabilidades = 100%</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {sortedOptions.map((option, index) => {
        const isWinner = isSettled && winningOptionId === option.id;
        const colors = optionColors[index % optionColors.length];
        const potentialReturn = (100 / option.currentPrice).toFixed(2);
        
        return (
          <div 
            key={option.id}
            className={cn(
              "p-3 rounded-lg border transition-colors duration-100",
              isWinner 
                ? "bg-yes/10 border-yes/30" 
                : cn(colors.bg, colors.border),
              canTrade && "hover:bg-muted/20"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Option image or initial */}
              {option.imageUrl ? (
                <div 
                  className="w-10 h-10 rounded-full bg-cover bg-center shrink-0 border-2 border-background"
                  style={{ backgroundImage: `url(${option.imageUrl})` }}
                />
              ) : (
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
                  colors.bg, colors.text
                )}>
                  {option.label.charAt(0)}
                </div>
              )}

              {/* Option info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium truncate",
                    isWinner && "text-yes"
                  )}>
                    {option.label}
                  </span>
                  {isWinner && (
                    <span className="text-yes text-sm">✓ Vencedor</span>
                  )}
                </div>
                
                {option.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {option.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="flex items-center gap-2 mt-2">
                  <Progress 
                    value={option.currentPrice} 
                    className="h-2 flex-1"
                  />
                  <span className={cn(
                    "text-sm font-bold shrink-0 min-w-[40px] text-right",
                    isWinner ? "text-yes" : colors.text
                  )}>
                    {option.currentPrice}%
                  </span>
                </div>
              </div>

              {/* Buy button or lock */}
              <div className="shrink-0">
                {canTrade ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-10 px-4 font-bold",
                          "hover:bg-primary/10 hover:text-primary hover:border-primary"
                        )}
                        onClick={() => onBuyOption(option)}
                      >
                        {option.currentPrice}¢
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <div className="text-center">
                        <p className="font-medium">Comprar {option.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          R$1 → R${potentialReturn} se vencer
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="h-10 w-14 rounded-md border border-border bg-muted/50 flex items-center justify-center">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Info box */}
      <div className="p-4 rounded-lg bg-secondary text-sm space-y-2 mt-4">
        <p className="font-medium">Como funciona?</p>
        <ul className="space-y-1 text-muted-foreground text-xs">
          <li>• Escolha a opção que você acredita que vai vencer</li>
          <li>• Contrato da opção vencedora paga <span className="font-semibold text-foreground">R${event.contractUnitCost.toFixed(2)}</span></li>
          <li>• Contratos das outras opções pagam R$0,00</li>
          <li>• Os preços somam 100% (menos taxas)</li>
        </ul>
      </div>
    </div>
  );
});
