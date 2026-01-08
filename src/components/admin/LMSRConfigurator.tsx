import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LMSRConfiguratorProps {
  initialYesOdds: number;
  liquidity: number;
  onYesOddsChange: (value: number) => void;
  onLiquidityChange: (value: number) => void;
}

export function LMSRConfigurator({
  initialYesOdds,
  liquidity,
  onYesOddsChange,
  onLiquidityChange,
}: LMSRConfiguratorProps) {
  const [localYesOdds, setLocalYesOdds] = useState(initialYesOdds);
  const [localLiquidity, setLocalLiquidity] = useState(liquidity);

  useEffect(() => {
    setLocalYesOdds(initialYesOdds);
  }, [initialYesOdds]);

  useEffect(() => {
    setLocalLiquidity(liquidity);
  }, [liquidity]);

  // Calculate price impact preview
  const calculateImpact = (shares: number) => {
    const b = localLiquidity;
    // Simplified impact calculation
    const impact = (shares / b) * 10;
    return Math.min(impact, 50).toFixed(1);
  };

  const getLiquidityLabel = () => {
    if (localLiquidity <= 50) return { label: 'Baixa', color: 'text-destructive' };
    if (localLiquidity <= 100) return { label: 'Média', color: 'text-warning' };
    return { label: 'Alta', color: 'text-success' };
  };

  const liquidityInfo = getLiquidityLabel();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Configuração LMSR</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  O LMSR (Logarithmic Market Scoring Rule) define como os preços mudam 
                  com base no volume de negociação. Maior liquidez = menor volatilidade.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Configure as odds iniciais e a liquidez do mercado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Initial YES Odds */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="yes-odds">Probabilidade Inicial SIM</Label>
            <div className="flex items-center gap-2">
              <Input
                id="yes-odds"
                type="number"
                min={1}
                max={99}
                value={localYesOdds}
                onChange={(e) => {
                  const val = Math.min(99, Math.max(1, parseInt(e.target.value) || 50));
                  setLocalYesOdds(val);
                  onYesOddsChange(val);
                }}
                className="w-20 text-center"
              />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>
          <Slider
            value={[localYesOdds]}
            onValueChange={([val]) => {
              setLocalYesOdds(val);
              onYesOddsChange(val);
            }}
            min={1}
            max={99}
            step={1}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>NÃO: {100 - localYesOdds}%</span>
            <span>SIM: {localYesOdds}%</span>
          </div>
        </div>

        {/* Liquidity Parameter */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="liquidity">Liquidez (b)</Label>
              <Badge variant="outline" className={liquidityInfo.color}>
                {liquidityInfo.label}
              </Badge>
            </div>
            <Input
              id="liquidity"
              type="number"
              min={10}
              max={500}
              value={localLiquidity}
              onChange={(e) => {
                const val = Math.min(500, Math.max(10, parseInt(e.target.value) || 100));
                setLocalLiquidity(val);
                onLiquidityChange(val);
              }}
              className="w-20 text-center"
            />
          </div>
          <Slider
            value={[localLiquidity]}
            onValueChange={([val]) => {
              setLocalLiquidity(val);
              onLiquidityChange(val);
            }}
            min={10}
            max={500}
            step={10}
            className="py-2"
          />
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="rounded bg-muted/50 p-2 text-center">
              <div className="font-medium text-destructive">50</div>
              <div>Alta volatilidade</div>
            </div>
            <div className="rounded bg-muted/50 p-2 text-center">
              <div className="font-medium text-warning">100</div>
              <div>Equilibrado</div>
            </div>
            <div className="rounded bg-muted/50 p-2 text-center">
              <div className="font-medium text-success">200+</div>
              <div>Preços estáveis</div>
            </div>
          </div>
        </div>

        {/* Impact Preview */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h4 className="mb-3 text-sm font-medium">Preview de Impacto</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compra de 100 SIM:</span>
              <span className="font-mono text-success">+{calculateImpact(100)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compra de 500 SIM:</span>
              <span className="font-mono text-success">+{calculateImpact(500)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compra de 1000 NÃO:</span>
              <span className="font-mono text-destructive">+{calculateImpact(1000)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
