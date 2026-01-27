import { useMemo, useState } from 'react';
import { Calculator, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlippageSelector } from './SlippageSelector';
import { cn } from '@/lib/utils';

interface MultiOptionNoPurchaseContentProps {
  minBuy: number;
  maxBuy: number;
  userBalance: number;
  slippageTolerance: number;
  onSlippageChange: (v: number) => void;
  isConfirming: boolean;
  onConfirm: (totalCost: number, slippageTolerance: number) => Promise<void>;
}

/**
 * Compra de NÃO em mercados MULTIPLE é feita por valor (R$):
 * o backend distribui esse orçamento comprando YES nas demais opções.
 */
export function MultiOptionNoPurchaseContent({
  minBuy,
  maxBuy,
  userBalance,
  slippageTolerance,
  onSlippageChange,
  isConfirming,
  onConfirm,
}: MultiOptionNoPurchaseContentProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const amountNum = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const quickAmounts = [10, 25, 50, 100];

  const handleConfirm = async () => {
    setError(null);

    if (amountNum <= 0) {
      setError('Insira um valor válido.');
      return;
    }
    if (amountNum < minBuy) {
      setError(`Valor mínimo: R$${minBuy}`);
      return;
    }
    if (amountNum > maxBuy) {
      setError(`Valor máximo: R$${maxBuy}`);
      return;
    }
    if (amountNum > userBalance) {
      setError('Saldo insuficiente.');
      return;
    }

    await onConfirm(amountNum, slippageTolerance);
  };

  return (
    <>
      <div className="p-5 space-y-5">
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Valor para investir</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              R$
            </span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder="0"
              className="h-12 text-lg font-mono pl-12 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="flex gap-2 mt-3">
            {quickAmounts.map((amt) => (
              <Button
                key={amt}
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setAmount(String(amt))}
              >
                R${amt}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gradient-card border border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calculator className="h-4 w-4" />
            Resumo da operação
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total a investir</span>
              <span className="font-mono text-lg font-bold text-foreground">
                R${amountNum.toFixed(2)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Na compra de <strong>NÃO</strong>, esse valor é distribuído automaticamente comprando <strong>SIM</strong> em todas as outras opções.
          </p>

          <div className="flex items-center justify-center">
            <SlippageSelector value={slippageTolerance} onChange={onSlippageChange} disabled={isConfirming} />
          </div>
        </div>

        {error && (
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg text-sm bg-destructive/10 border border-destructive/30 text-destructive'
          )}>
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      <div className="p-5 pt-0">
        <Button
          variant="default"
          size="lg"
          className="w-full"
          onClick={handleConfirm}
          disabled={isConfirming || amountNum <= 0}
        >
          {isConfirming ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Processando...
            </>
          ) : (
            <>Confirmar Compra NÃO - R${amountNum.toFixed(2)}</>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          Saldo disponível: <span className="font-mono font-medium">R${userBalance.toFixed(2)}</span>
        </p>
      </div>
    </>
  );
}
