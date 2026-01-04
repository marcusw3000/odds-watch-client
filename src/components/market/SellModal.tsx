import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, RefreshCw, Clock, TrendingDown, Calculator } from 'lucide-react';
import { UserContract } from '@/types/market';
import { Button } from '@/components/ui/button';
import { OddsBadge } from './OddsBadge';
import { cn } from '@/lib/utils';

interface SellModalProps {
  contract: UserContract;
  currentMarketPrice: number;
  onClose: () => void;
  onConfirm: (currentPrice: number) => Promise<void>;
  onRefreshPrice: () => Promise<number>;
}

const PRICE_VALIDITY_SECONDS = 15;

export function SellModal({
  contract,
  currentMarketPrice,
  onClose,
  onConfirm,
  onRefreshPrice,
}: SellModalProps) {
  const [lockedPrice, setLockedPrice] = useState(currentMarketPrice);
  const [timeRemaining, setTimeRemaining] = useState(PRICE_VALIDITY_SECONDS);
  const [priceExpired, setPriceExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isYes = contract.outcome === 'YES';
  const purchaseCost = (contract.priceAtPurchase / 100) * contract.quantity;
  const saleValue = (lockedPrice / 100) * contract.quantity;
  const profitLoss = saleValue - purchaseCost;
  const profitLossPercent = ((profitLoss / purchaseCost) * 100).toFixed(1);

  // Timer countdown
  useEffect(() => {
    if (priceExpired) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setPriceExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [priceExpired]);

  const handleRefreshPrice = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      const newPrice = await onRefreshPrice();
      setLockedPrice(newPrice);
      setTimeRemaining(PRICE_VALIDITY_SECONDS);
      setPriceExpired(false);
    } catch {
      setError('Erro ao atualizar preço. Tente novamente.');
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshPrice]);

  const handleConfirm = async () => {
    if (priceExpired) {
      setError('Preço expirado. Atualize antes de confirmar.');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      await onConfirm(lockedPrice);
    } catch {
      setError('Erro ao processar venda. Tente novamente.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-elevated animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Vender Contrato</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Contract Info */}
          <div className="p-4 rounded-lg bg-secondary">
            <p className="text-sm text-muted-foreground mb-1">Contrato</p>
            <p className="font-medium leading-snug">{contract.eventTitle}</p>
          </div>

          {/* Contract Details */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Sua posição</p>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-3 py-1.5 rounded-lg font-bold text-lg",
                  isYes ? "bg-yes-muted text-yes" : "bg-no-muted text-no"
                )}>
                  {contract.outcome === 'YES' ? 'SIM' : 'NÃO'}
                </span>
                <span className="text-muted-foreground">x{contract.quantity}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Preço de mercado</p>
              <OddsBadge
                type={contract.outcome}
                price={lockedPrice}
                probability={lockedPrice}
                size="md"
                animated={isRefreshing}
              />
            </div>
          </div>

          {/* Price Timer */}
          <div className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            priceExpired 
              ? "border-destructive/50 bg-destructive/10" 
              : timeRemaining <= 5 
                ? "border-warning/50 bg-warning/10" 
                : "border-border bg-secondary"
          )}>
            <div className="flex items-center gap-2">
              <Clock className={cn(
                "h-4 w-4",
                priceExpired ? "text-destructive" : "text-muted-foreground"
              )} />
              <span className="text-sm">
                {priceExpired 
                  ? "Preço expirado" 
                  : `Preço válido por ${timeRemaining}s`
                }
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshPrice}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")} />
              Atualizar
            </Button>
          </div>

          {/* Summary */}
          <div className="p-4 rounded-lg bg-gradient-card border border-border space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calculator className="h-4 w-4" />
              Resumo da operação
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo de compra</span>
                <span className="font-mono font-medium">R${purchaseCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor de venda</span>
                <span className="font-mono font-medium">R${saleValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Resultado
                </span>
                <span className={cn(
                  "font-mono font-bold",
                  profitLoss >= 0 ? "text-success" : "text-destructive"
                )}>
                  {profitLoss >= 0 ? '+' : ''}R${profitLoss.toFixed(2)} ({profitLoss >= 0 ? '+' : ''}{profitLossPercent}%)
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 pt-0">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleConfirm}
            disabled={priceExpired || isConfirming}
          >
            {isConfirming ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>Confirmar Venda - R${saleValue.toFixed(2)}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
