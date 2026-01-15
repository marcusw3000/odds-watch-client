import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, RefreshCw, Clock, TrendingUp, Calculator, ChevronUp, ChevronDown } from 'lucide-react';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OddsBadge } from './OddsBadge';
import { cn } from '@/lib/utils';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { TradeQuote } from '@/services/LMSRCalculator';
import { FeeEngine } from '@/services/FeeEngine';
import { FeeRule } from '@/types/financial';
import { PurchaseSuccessModal } from './PurchaseSuccessModal';

// Custom hook for debouncing values
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

interface PurchaseModalProps {
  event: MarketEvent;
  selectedOutcome: 'YES' | 'NO';
  userBalance: number;
  onClose: () => void;
  onConfirm: (shares: number, maxCost: number) => Promise<void>;
  onRefreshPrice: () => Promise<MarketEvent | null>;
}

interface SuccessData {
  shares: number;
  totalCost: number;
  potentialProfit: number;
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
  const [shares, setShares] = useState<string>('');
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(PRICE_VALIDITY_SECONDS);
  const [priceExpired, setPriceExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeRule, setFeeRule] = useState<FeeRule | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Fetch fee rule on mount
  useEffect(() => {
    const fetchFeeRule = async () => {
      const rule = await FeeEngine.getActiveRule('TRADE');
      setFeeRule(rule);
    };
    fetchFeeRule();
  }, []);

  const isYes = selectedOutcome === 'YES';
  const sharesNum = parseFloat(shares) || 0;
  const debouncedShares = useDebouncedValue(sharesNum, 300);
  const currentPrice = event.outcomes[selectedOutcome].price;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch quote when debounced shares change
  useEffect(() => {
    if (debouncedShares <= 0) {
      setQuote(null);
      return;
    }

    const fetchQuote = async () => {
      const newQuote = await MarketDataProvider.getQuote(event.id, selectedOutcome, debouncedShares);
      setQuote(newQuote);
    };

    fetchQuote();
  }, [debouncedShares, event.id, selectedOutcome]);

  // Timer countdown - optimized with ref
  useEffect(() => {
    if (priceExpired) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setPriceExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [priceExpired]);

  const handleRefreshPrice = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      await onRefreshPrice();
      // Re-fetch quote with new prices
      if (sharesNum > 0) {
        const newQuote = await MarketDataProvider.getQuote(event.id, selectedOutcome, sharesNum);
        setQuote(newQuote);
      }
      setTimeRemaining(PRICE_VALIDITY_SECONDS);
      setPriceExpired(false);
    } catch {
      setError('Erro ao atualizar preço. Tente novamente.');
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshPrice, event.id, selectedOutcome, sharesNum]);

  const handleConfirm = async () => {
    if (priceExpired) {
      setError('Preço expirado. Atualize antes de confirmar.');
      return;
    }

    if (!quote || sharesNum <= 0) {
      setError('Insira uma quantidade válida.');
      return;
    }

    if (quote.cost < event.limits.minBuy) {
      setError(`Valor mínimo: R$${event.limits.minBuy}`);
      return;
    }

    if (quote.cost > event.limits.maxBuy) {
      setError(`Valor máximo: R$${event.limits.maxBuy}`);
      return;
    }

    if (quote.cost > userBalance) {
      setError('Saldo insuficiente.');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      // Calculate profit for success modal (no fee)
      const totalCost = quote.cost;
      const potentialProfit = sharesNum - totalCost;

      await onConfirm(sharesNum, quote.cost);
      
      // Show success modal
      setSuccessData({
        shares: sharesNum,
        totalCost: totalCost,
        potentialProfit,
      });
    } catch {
      setError('Erro ao processar compra. Tente novamente.');
    } finally {
      setIsConfirming(false);
    }
  };

  const quickShares = [10, 25, 50, 100];

  // Show success modal if purchase completed
  if (successData) {
    return (
      <PurchaseSuccessModal
        eventTitle={event.title}
        eventId={event.id}
        outcome={selectedOutcome}
        shares={successData.shares}
        totalCost={successData.totalCost}
        potentialProfit={successData.potentialProfit}
        onClose={onClose}
      />
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-elevated animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
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
                price={currentPrice}
                probability={currentPrice}
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

          {/* Shares Input */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Quantidade de contratos
            </label>
            <div className="relative flex items-center">
              <Input
                type="number"
                value={shares}
                onChange={(e) => {
                  setShares(e.target.value);
                  setError(null);
                }}
                placeholder="Quantos contratos?"
                className="h-12 text-lg font-mono pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setShares(String(Math.max(1, sharesNum + 1)))}
                  className="flex items-center justify-center h-5 w-10 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShares(String(Math.max(1, sharesNum - 1)))}
                  className="flex items-center justify-center h-5 w-10 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {quickShares.map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShares(String(amt))}
                >
                  {amt}
                </Button>
              ))}
            </div>
          </div>

          {/* Summary with LMSR data */}
          {quote && sharesNum > 0 && (() => {
            const potentialProfit = sharesNum - quote.cost;
            
            return (
              <div className="p-4 rounded-lg bg-gradient-card border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calculator className="h-4 w-4" />
                  Resumo da operação
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contratos</span>
                    <span className="font-mono font-medium">{sharesNum}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preço médio</span>
                    <span className="font-mono font-medium">R${(quote.avgPrice / 100).toFixed(2)}</span>
                  </div>
                  
                  {/* Total */}
                  <div className="flex justify-between pt-2 border-t border-border font-medium">
                    <span>Custo contratos</span>
                    <span className="font-mono text-foreground">R${quote.cost.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Lucro potencial
                    </span>
                    <span className={cn(
                      "font-mono font-bold",
                      potentialProfit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {potentialProfit >= 0 ? '+' : ''}R${potentialProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Se {selectedOutcome === 'YES' ? 'SIM' : 'NÃO'} vencer, cada contrato paga R$1,00
                </p>
              </div>
            );
          })()}

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
            disabled={priceExpired || isConfirming || !quote || sharesNum <= 0}
          >
            {isConfirming ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : quote ? (
              <>Confirmar Compra - R${quote.cost.toFixed(2)}</>
            ) : (
              <>Insira quantidade</>
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
