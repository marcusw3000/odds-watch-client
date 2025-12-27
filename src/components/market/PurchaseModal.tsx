import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, RefreshCw, Clock, TrendingUp, Calculator } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OddsBadge } from './OddsBadge';
import { cn } from '@/lib/utils';

interface PurchaseModalProps {
  event: MarketEvent;
  selectedOutcome: 'YES' | 'NO';
  userBalance: number;
  onClose: () => void;
  onConfirm: (quantity: number, lockedPrice: number) => Promise<void>;
  onRefreshPrice: () => Promise<MarketEvent | null>;
}

const PRICE_VALIDITY_SECONDS = 15;

export function PurchaseModal({
  event,
  selectedOutcome,
  userBalance,
  onClose,
  onConfirm,
  onRefreshPrice,
}: PurchaseModalProps) {
  const [quantity, setQuantity] = useState<string>('');
  const [lockedPrice, setLockedPrice] = useState(event.outcomes[selectedOutcome].price);
  const [timeRemaining, setTimeRemaining] = useState(PRICE_VALIDITY_SECONDS);
  const [priceExpired, setPriceExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isYes = selectedOutcome === 'YES';
  const quantityNum = parseFloat(quantity) || 0;
  const totalCost = (lockedPrice / 100) * quantityNum;
  const potentialProfit = quantityNum - totalCost;
  const contracts = Math.floor((quantityNum * 100) / lockedPrice);

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
      const updatedEvent = await onRefreshPrice();
      if (updatedEvent) {
        setLockedPrice(updatedEvent.outcomes[selectedOutcome].price);
        setTimeRemaining(PRICE_VALIDITY_SECONDS);
        setPriceExpired(false);
      }
    } catch {
      setError('Erro ao atualizar preço. Tente novamente.');
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshPrice, selectedOutcome]);

  const handleConfirm = async () => {
    if (priceExpired) {
      setError('Preço expirado. Atualize antes de confirmar.');
      return;
    }

    if (quantityNum < event.limits.minBuy) {
      setError(`Valor mínimo: R$${event.limits.minBuy}`);
      return;
    }

    if (quantityNum > event.limits.maxBuy) {
      setError(`Valor máximo: R$${event.limits.maxBuy}`);
      return;
    }

    if (totalCost > userBalance) {
      setError('Saldo insuficiente.');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      await onConfirm(quantityNum, lockedPrice);
    } catch {
      setError('Erro ao processar compra. Tente novamente.');
    } finally {
      setIsConfirming(false);
    }
  };

  const quickAmounts = [50, 100, 250, 500];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-elevated animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Comprar Contrato</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Event Title */}
          <div className="p-4 rounded-lg bg-secondary">
            <p className="text-sm text-muted-foreground mb-1">Evento</p>
            <p className="font-medium leading-snug">{event.title}</p>
          </div>

          {/* Selected Outcome */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Sua aposta</p>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-3 py-1.5 rounded-lg font-bold text-lg",
                  isYes ? "bg-yes-muted text-yes" : "bg-no-muted text-no"
                )}>
                  {selectedOutcome === 'YES' ? 'SIM' : 'NÃO'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Preço atual</p>
              <OddsBadge
                type={selectedOutcome}
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

          {/* Quantity Input */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Valor a investir (R$)
            </label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setError(null);
              }}
              placeholder={`Mín: R$${event.limits.minBuy} | Máx: R$${event.limits.maxBuy}`}
              className="h-12 text-lg font-mono"
            />
            <div className="flex gap-2 mt-3">
              {quickAmounts.map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setQuantity(String(amt))}
                >
                  R${amt}
                </Button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {quantityNum > 0 && (
            <div className="p-4 rounded-lg bg-gradient-card border border-border space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calculator className="h-4 w-4" />
                Resumo da operação
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contratos</span>
                  <span className="font-mono font-medium">{contracts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo total</span>
                  <span className="font-mono font-medium">R${totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Lucro potencial
                  </span>
                  <span className="font-mono font-bold text-success">
                    +R${potentialProfit.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Se {selectedOutcome === 'YES' ? 'SIM' : 'NÃO'} vencer, cada contrato paga R$1,00
              </p>
            </div>
          )}

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
            variant={isYes ? 'yes' : 'no'}
            size="lg"
            className="w-full"
            onClick={handleConfirm}
            disabled={priceExpired || isConfirming || quantityNum <= 0}
          >
            {isConfirming ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>Confirmar Compra - R${totalCost.toFixed(2)}</>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-3">
            Saldo disponível: <span className="font-mono font-medium">R${userBalance.toFixed(2)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
