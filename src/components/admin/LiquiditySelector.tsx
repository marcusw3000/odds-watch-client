import { Info, Droplets, Droplet, Waves } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LiquidityLevel, LIQUIDITY_CONFIG } from '@/types/admin';
import { cn } from '@/lib/utils';

interface LiquiditySelectorProps {
  value: LiquidityLevel;
  onChange: (value: LiquidityLevel) => void;
  initialPrice?: number; // 0-100 percentage
  disabled?: boolean;
}

export function LiquiditySelector({ value, onChange, initialPrice = 50, disabled }: LiquiditySelectorProps) {
  // Simulate price impact for R$100 purchase
  const simulateImpact = (lmsrB: number): number => {
    // Simplified LMSR formula for impact visualization
    // For a more accurate calculation, we'd need the full LMSR state
    const buyAmount = 100; // R$100
    const impactFactor = buyAmount / lmsrB;
    return Math.min(25, impactFactor * 30); // Cap at 25%
  };

  const levels: { key: LiquidityLevel; icon: typeof Droplet }[] = [
    { key: 'low', icon: Droplet },
    { key: 'medium', icon: Droplets },
    { key: 'high', icon: Waves },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Liquidez do Mercado</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>
                  A liquidez define quão sensível o preço é às negociações. 
                  Maior liquidez = preços mais estáveis, menor reação a trades.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Define a estabilidade dos preços em relação ao volume de trades
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as LiquidityLevel)}
          disabled={disabled}
          className="grid grid-cols-3 gap-3"
        >
          {levels.map(({ key, icon: Icon }) => {
            const config = LIQUIDITY_CONFIG[key];
            const impact = simulateImpact(config.b);
            const isSelected = value === key;
            
            return (
              <label
                key={key}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-all',
                  isSelected 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <RadioGroupItem value={key} className="sr-only" />
                <Icon className={cn('h-6 w-6', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                <span className="font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground">b = {config.b}</span>
                
                {/* Impact visualization */}
                <div className="w-full mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>R$100 →</span>
                    <span className={cn(
                      'font-medium',
                      impact > 15 ? 'text-destructive' : impact > 8 ? 'text-warning' : 'text-success'
                    )}>
                      {config.impact}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        impact > 15 ? 'bg-destructive' : impact > 8 ? 'bg-warning' : 'bg-success'
                      )}
                      style={{ width: `${Math.min(100, impact * 4)}%` }}
                    />
                  </div>
                </div>
              </label>
            );
          })}
        </RadioGroup>

        {/* Description for selected level */}
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <p className="text-muted-foreground">
            <strong>{LIQUIDITY_CONFIG[value].label}:</strong> {LIQUIDITY_CONFIG[value].description}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Uma compra de R$100 move o preço aproximadamente {LIQUIDITY_CONFIG[value].impact}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
