import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, RefreshCw, Clock, TrendingUp, Calculator, ChevronUp, ChevronDown, Zap } from 'lucide-react';
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
import { SlippageSelector } from './SlippageSelector';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';

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
  const [slippageDetected, setSlippageDetected] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(0.05); // 5% default
  
  const isMobile = useIsMobile();

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
    setSlippageDetected(false);
    
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
      
      // Use selected slippage tolerance for maxCost
      const maxCostWithSlippage = quote.cost * (1 + slippageTolerance);

      await onConfirm(sharesNum, maxCostWithSlippage);
      
      // Show success modal
      setSuccessData({
        shares: sharesNum,
        totalCost: totalCost,
        potentialProfit,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '';
      
      // Detectar erro de slippage
      if (errorMessage.includes('preço mudou') || errorMessage.includes('preco mudou') || errorMessage.includes('slippage')) {
        setSlippageDetected(true);
        setError('O preço mudou desde sua cotação. O preço foi atualizado automaticamente.');
        // Atualizar preço automaticamente
        handleRefreshPrice();
      } else {
        setError(errorMessage || 'Erro ao processar compra. Tente novamente.');
      }
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

  // Modal content (shared between Dialog and Drawer)
  const modalContent = (
    <>
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

              {/* Price Impact Warning */}
              {Math.abs(quote.priceImpact) > 0.5 && (
                <div className={cn(
                  "flex items-center gap-2 p-2 rounded-md",
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

              {/* New prices after purchase */}
              <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Preços após compra:</span>
                  <span className="font-mono">
                    SIM: {quote.newYesPrice}¢ | NÃO: {quote.newNoPrice}¢
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Se {selectedOutcome === 'YES' ? 'SIM' : 'NÃO'} vencer, cada contrato paga R$1,00
              </p>

              <div className="flex items-center justify-center">
                <SlippageSelector 
                  value={slippageTolerance} 
                  onChange={setSlippageTolerance}
                  disabled={isConfirming}
                />
              </div>
            </div>
          );
        })()}

        {/* Error/Slippage Message */}
        {error && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-lg text-sm",
            slippageDetected 
              ? "bg-warning/10 border border-warning/30 text-warning-foreground" 
              : "bg-destructive/10 border border-destructive/30 text-destructive"
          )}>
            <AlertCircle className={cn(
              "h-4 w-4 flex-shrink-0",
              slippageDetected ? "text-warning" : "text-destructive"
            )} />
            <div className="flex-1">
              <p>{error}</p>
              {slippageDetected && quote && (
                <p className="mt-1 font-medium">
                  Novo preço: R${(quote.avgPrice / 100).toFixed(2)} por contrato
                </p>
              )}
            </div>
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
    </>
  );

  // Mobile: use Drawer
  if (isMobile) {
    return (
      <Drawer open={true} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="flex items-center justify-between border-b border-border pb-4">
            <DrawerTitle>Comprar Contrato</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="overflow-y-auto">
            {modalContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: use existing fixed modal
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

        {modalContent}
      </div>
    </div>
  );
}
