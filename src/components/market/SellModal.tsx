import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, RefreshCw, Clock, TrendingDown, Calculator, Zap, Lock, CheckCircle } from 'lucide-react';
import { UserContract } from '@/types/market';
import { Button } from '@/components/ui/button';
import { OddsBadge } from './OddsBadge';
import { cn } from '@/lib/utils';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { TradeQuote } from '@/services/LMSRCalculator';
import { Progress } from '@/components/ui/progress';

interface SellModalProps {
  contract: UserContract;
  currentMarketPrice: number;
  onClose: () => void;
  onConfirm: (minValue: number) => Promise<void>;
  onRefreshPrice: () => Promise<number>;
}

const PRICE_VALIDITY_SECONDS = 15;
const CONFIRM_COUNTDOWN_SECONDS = 3;

type ConfirmState = 'idle' | 'countdown' | 'executing' | 'success';

export function SellModal({
  contract,
  currentMarketPrice,
  onClose,
  onConfirm,
  onRefreshPrice,
}: SellModalProps) {
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(PRICE_VALIDITY_SECONDS);
  const [priceExpired, setPriceExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Confirmation state
  const [confirmState, setConfirmState] = useState<ConfirmState>('idle');
  const [confirmCountdown, setConfirmCountdown] = useState(CONFIRM_COUNTDOWN_SECONDS);
  const [lockedPrice, setLockedPrice] = useState<number | null>(null);
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isYes = contract.outcome === 'YES';
  const purchaseCost = (contract.priceAtPurchase / 100) * contract.quantity;

  // Fetch sell quote on mount and when refreshing
  const fetchQuote = useCallback(async () => {
    const newQuote = await MarketDataProvider.getSellQuote(
      contract.eventId,
      contract.outcome,
      contract.quantity
    );
    setQuote(newQuote);
  }, [contract.eventId, contract.outcome, contract.quantity]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Sale value (no fee)
  const saleValue = quote?.cost ?? (currentMarketPrice / 100) * contract.quantity;
  const displayValue = lockedPrice ?? saleValue;
  const profitLoss = displayValue - purchaseCost;
  const profitLossPercent = purchaseCost > 0 ? ((profitLoss / purchaseCost) * 100).toFixed(1) : '0.0';

  // Timer countdown for price validity
  useEffect(() => {
    if (priceExpired || confirmState !== 'idle') return;

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
  }, [priceExpired, confirmState]);

  // Cleanup confirm timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) {
        clearInterval(confirmTimerRef.current);
      }
    };
  }, []);

  const handleRefreshPrice = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    setConfirmState('idle');
    setLockedPrice(null);
    
    try {
      await onRefreshPrice();
      await fetchQuote();
      setTimeRemaining(PRICE_VALIDITY_SECONDS);
      setPriceExpired(false);
    } catch {
      setError('Erro ao atualizar preço. Tente novamente.');
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshPrice, fetchQuote]);

  const startConfirmCountdown = () => {
    if (priceExpired || !quote) return;
    
    // Lock the current price
    setLockedPrice(quote.cost);
    setConfirmState('countdown');
    setConfirmCountdown(CONFIRM_COUNTDOWN_SECONDS);
    setError(null);

    confirmTimerRef.current = setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev <= 1) {
          if (confirmTimerRef.current) {
            clearInterval(confirmTimerRef.current);
          }
          executeConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelConfirmCountdown = () => {
    if (confirmTimerRef.current) {
      clearInterval(confirmTimerRef.current);
    }
    setConfirmState('idle');
    setLockedPrice(null);
    setConfirmCountdown(CONFIRM_COUNTDOWN_SECONDS);
  };

  const executeConfirm = async () => {
    setConfirmState('executing');

    try {
      await onConfirm(lockedPrice ?? saleValue);
      setConfirmState('success');
    } catch {
      setError('Erro ao processar venda. Tente novamente.');
      setConfirmState('idle');
      setLockedPrice(null);
    }
  };

  const getButtonContent = () => {
    switch (confirmState) {
      case 'countdown':
        return (
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6">
              <svg className="w-6 h-6 transform -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  opacity="0.2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${(confirmCountdown / CONFIRM_COUNTDOWN_SECONDS) * 62.8} 62.8`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {confirmCountdown}
              </span>
            </div>
            <span>Confirmando em {confirmCountdown}s...</span>
          </div>
        );
      case 'executing':
        return (
          <>
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Processando venda...
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            Venda realizada!
          </>
        );
      default:
        return <>Confirmar Venda - R${displayValue.toFixed(2)}</>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-elevated animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Vender Contrato</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            disabled={confirmState === 'executing'}
          >
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
                price={currentMarketPrice}
                probability={currentMarketPrice}
                size="md"
                animated={isRefreshing}
              />
            </div>
          </div>

          {/* Price Timer / Locked Price Indicator */}
          {lockedPrice ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-success/50 bg-success/10">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-success" />
                <span className="text-sm text-success font-medium">
                  Preço travado: R${lockedPrice.toFixed(2)}
                </span>
              </div>
              {confirmState === 'countdown' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelConfirmCountdown}
                  className="text-destructive hover:text-destructive"
                >
                  Cancelar
                </Button>
              )}
            </div>
          ) : (
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
          )}

          {/* Confirmation Progress Bar */}
          {confirmState === 'countdown' && (
            <div className="space-y-2">
              <Progress 
                value={(confirmCountdown / CONFIRM_COUNTDOWN_SECONDS) * 100} 
                className="h-2"
              />
              <p className="text-xs text-center text-muted-foreground">
                A venda será executada automaticamente. Clique em "Cancelar" para interromper.
              </p>
            </div>
          )}

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
              {quote && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço médio de venda</span>
                  <span className="font-mono font-medium">R${(quote.avgPrice / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor de venda</span>
                <span className={cn(
                  "font-mono font-medium",
                  lockedPrice && "text-success"
                )}>
                  {lockedPrice && <Lock className="h-3 w-3 inline mr-1" />}
                  R${displayValue.toFixed(2)}
                </span>
              </div>

              {/* Price Impact Warning */}
              {quote && Math.abs(quote.priceImpact) > 0.5 && (
                <div className={cn(
                  "flex items-center gap-2 p-2 rounded-md mt-2",
                  Math.abs(quote.priceImpact) > 5 
                    ? "bg-warning/20 text-warning" 
                    : "bg-muted text-muted-foreground"
                )}>
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    Impacto no preço: {quote.priceImpact > 0 ? '+' : ''}{quote.priceImpact.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* New prices after trade */}
              {quote && (
                <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Preço após venda:</span>
                    <span className="font-mono">
                      SIM: {quote.newYesPrice}¢ | NÃO: {quote.newNoPrice}¢
                    </span>
                  </div>
                </div>
              )}

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
            variant={confirmState === 'countdown' ? 'default' : 'outline'}
            size="lg"
            className={cn(
              "w-full transition-all",
              confirmState === 'countdown' && "bg-success hover:bg-success/90",
              confirmState === 'success' && "bg-success hover:bg-success/90"
            )}
            onClick={confirmState === 'idle' ? startConfirmCountdown : undefined}
            disabled={priceExpired || confirmState === 'executing' || !quote || confirmState === 'success'}
          >
            {getButtonContent()}
          </Button>
        </div>
      </div>
    </div>
  );
}
