import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, AlertCircle, RefreshCw, Clock, TrendingUp, Calculator, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { MarketEvent, MarketOption } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { optimizeImageUrl } from '@/lib/formatters';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { PurchaseSuccessModal } from './PurchaseSuccessModal';
import { SlippageSelector } from './SlippageSelector';
import { Progress } from '@/components/ui/progress';
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

interface MultiOptionPurchaseModalProps {
  event: MarketEvent;
  selectedOption: MarketOption;
  side: 'YES' | 'NO';
  userBalance: number;
  onClose: () => void;
  onConfirm: (optionId: string, shares: number, maxCost: number, side: 'YES' | 'NO') => Promise<void>;
  onRefreshPrice: () => Promise<MarketEvent | null>;
}

interface SuccessData {
  shares: number;
  totalCost: number;
  potentialProfit: number;
}

interface MultiOptionQuote {
  cost: number;
  avgPrice: number;
  priceImpact: number;
  newPrices: number[];
}

const PRICE_VALIDITY_SECONDS = 15;

export function MultiOptionPurchaseModal({
  event,
  selectedOption,
  side,
  userBalance,
  onClose,
  onConfirm,
  onRefreshPrice,
}: MultiOptionPurchaseModalProps) {
  const [shares, setShares] = useState<string>('');
  const [quote, setQuote] = useState<MultiOptionQuote | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(PRICE_VALIDITY_SECONDS);
  const [priceExpired, setPriceExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [slippageDetected, setSlippageDetected] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(0.05);
  
  const isMobile = useIsMobile();

  const sharesNum = parseFloat(shares) || 0;
  const debouncedShares = useDebouncedValue(sharesNum, 300);
  const currentPrice = side === 'YES' ? selectedOption.currentPrice : (100 - selectedOption.currentPrice);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Other options context (only for NO side explanation text)
  const otherOptions = useMemo(() => 
    (event.options || []).filter(opt => opt.id !== selectedOption.id),
    [event.options, selectedOption.id]
  );

  // For NO contracts (Kalshi-style), we use a simple price calculation
  // Price NO = 100% - Price YES
  // This creates a single contract that pays if the option DOES NOT win
  
  // Calculate quote - for YES use LMSR, for NO use simple price calculation
  useEffect(() => {
    if (debouncedShares <= 0) {
      setQuote(null);
      return;
    }

    if (side === 'NO') {
      // Kalshi-style NO contract: simple price = 1 - YES price
      const noPrice = (100 - selectedOption.currentPrice) / 100;
      const cost = debouncedShares * noPrice;
      
      setQuote({
        cost,
        avgPrice: Math.round(noPrice * 100),
        priceImpact: 0, // NO contracts don't move the market
        newPrices: [], // Prices don't change for NO contracts
      });
      return;
    }

    // YES contracts use LMSR calculation
    const options = event.options || [];
    const lmsrB = event.lmsr?.b || 100;
    
    // Get current shares from options
    const currentShares = options.map(opt => opt.shares || 0);
    const optionIndex = options.findIndex(opt => opt.id === selectedOption.id);
    
    if (optionIndex === -1) {
      setQuote(null);
      return;
    }

    // LMSR cost function: C(q) = b * ln(Σ e^(qi/b))
    // Using log-sum-exp trick for numerical stability
    const costFunction = (shares: number[]): number => {
      if (shares.length === 0) return 0;
      const scaledShares = shares.map(q => q / lmsrB);
      const maxVal = Math.max(...scaledShares);
      const sumExp = scaledShares.reduce((sum, x) => sum + Math.exp(x - maxVal), 0);
      return lmsrB * (maxVal + Math.log(sumExp));
    };

    // Calculate prices from shares
    const getPrices = (shares: number[]): number[] => {
      if (shares.length === 0) return [];
      if (shares.length === 1) return [100];
      const scaledShares = shares.map(q => q / lmsrB);
      const maxVal = Math.max(...scaledShares);
      const expValues = scaledShares.map(x => Math.exp(x - maxVal));
      const sumExp = expValues.reduce((sum, x) => sum + x, 0);
      return expValues.map(exp => Math.max(1, Math.min(99, Math.round((exp / sumExp) * 100))));
    };

    const currentCost = costFunction(currentShares);
    
    // Calculate new shares after buying
    const newShares = [...currentShares];
    newShares[optionIndex] += debouncedShares;
    
    const newCost = costFunction(newShares);
    const tradeCost = newCost - currentCost;
    const avgPrice = (tradeCost / debouncedShares) * 100;
    
    const currentPrices = getPrices(currentShares);
    const newPrices = getPrices(newShares);
    
    const currentOptionPrice = currentPrices[optionIndex] || currentPrice;
    const newOptionPrice = newPrices[optionIndex] || currentPrice;
    const priceImpact = currentOptionPrice > 0 
      ? ((newOptionPrice - currentOptionPrice) / currentOptionPrice) * 100 
      : 0;
    
    setQuote({
      cost: tradeCost,
      avgPrice: Math.round(avgPrice),
      priceImpact,
      newPrices,
    });
  }, [debouncedShares, currentPrice, event.options, event.lmsr, selectedOption.id]);

  // Timer countdown
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
      const totalCost = quote.cost;
      const potentialProfit = sharesNum - totalCost;
      const maxCostWithSlippage = quote.cost * (1 + slippageTolerance);

      await onConfirm(selectedOption.id, sharesNum, maxCostWithSlippage, side);
      
      setSuccessData({
        shares: sharesNum,
        totalCost,
        potentialProfit,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '';
      
      // Catch slippage/price change errors and auto-refresh
      if (
        errorMessage.includes('preço mudou') || 
        errorMessage.includes('slippage') ||
        errorMessage.includes('Preço excedeu') ||
        errorMessage.includes('custo máximo')
      ) {
        setSlippageDetected(true);
        setError('O preço mudou desde sua cotação. Atualizando preços...');
        handleRefreshPrice();
      } else {
        setError(errorMessage || 'Erro ao processar compra. Tente novamente.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const quickShares = [10, 25, 50, 100];

  // For context display (show first 3 other options) - only used in NO explanation
  // Note: displayOtherOptions removed as otherOptions is used directly in the JSX

  if (successData) {
    return (
      <PurchaseSuccessModal
        eventTitle={event.title}
        eventId={event.id}
        outcome={side}
        optionLabel={selectedOption.label}
        shares={successData.shares}
        totalCost={successData.totalCost}
        potentialProfit={successData.potentialProfit}
        onClose={onClose}
      />
    );
  }

  const modalContent = (
    <>
      <div className="p-5 space-y-5">
        {/* Event Title */}
        <div className="p-4 rounded-lg bg-secondary">
          <p className="text-sm text-muted-foreground mb-1">Evento</p>
          <p className="font-medium leading-snug">{event.title}</p>
        </div>

        {/* Selected Option */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Sua posição</p>
            <div className="flex items-center gap-2">
              {selectedOption.imageUrl ? (
                <div 
                  className="w-8 h-8 rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${optimizeImageUrl(selectedOption.imageUrl, { width: 64 })})` }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  {selectedOption.label.charAt(0)}
                </div>
              )}
              <div className="flex flex-col">
                <span className={cn(
                  "px-3 py-1.5 rounded-lg font-bold text-lg",
                  side === 'YES' ? "bg-yes/20 text-yes" : "bg-no/20 text-no"
                )}>
                  {side === 'YES' ? 'SIM' : 'NÃO'} {selectedOption.label}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Preço atual</p>
            <span className={cn(
              "text-2xl font-bold",
              side === 'YES' ? "text-yes" : "text-no",
              isRefreshing && "animate-pulse"
            )}>
              {currentPrice}¢
            </span>
          </div>
        </div>

        {/* Explanation for NO contracts */}
        {side === 'NO' && (
          <div className="space-y-2 p-3 rounded-lg bg-no/10 border border-no/20">
            <p className="text-xs font-medium text-no">Contrato NÃO (Kalshi-style)</p>
            <p className="text-xs text-muted-foreground">
              Você ganha R$1 por contrato se <span className="font-medium">{selectedOption.label}</span> <strong>NÃO</strong> vencer.
              {otherOptions.length > 0 && (
                <span> Ou seja, se qualquer outra opção vencer ({otherOptions.slice(0, 3).map(o => o.label).join(', ')}{otherOptions.length > 3 ? '...' : ''}).</span>
              )}
            </p>
            <p className="text-xs text-no">
              ⚠️ Se {selectedOption.label} vencer, você perde 100% do investimento.
            </p>
          </div>
        )}

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

        {/* Summary */}
        {quote && sharesNum > 0 && (() => {
          const potentialReturn = sharesNum;
          const roi = ((potentialReturn - quote.cost) / quote.cost) * 100;
          
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
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total a pagar</span>
                  <span className="font-mono text-lg font-bold text-foreground">
                    R${quote.cost.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {side === 'YES' 
                    ? `Retorno se ${selectedOption.label} vencer`
                    : `Retorno se ${selectedOption.label} NÃO vencer`
                  }
                </span>
                <span className="font-mono">
                  R${potentialReturn.toFixed(2)} (+{roi.toFixed(2)}%)
                </span>
              </div>

              {side === 'YES' && Math.abs(quote.priceImpact) > 0.5 && (
                <div className={cn(
                  "flex items-center gap-2 p-2 rounded-md",
                  Math.abs(quote.priceImpact) > 5 
                    ? "bg-warning/20 text-warning" 
                    : "bg-muted text-muted-foreground"
                )}>
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    Impacto no preço: +{quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {side === 'YES'
                  ? `Se ${selectedOption.label} vencer, cada contrato paga R$1,00`
                  : `Se ${selectedOption.label} NÃO vencer, cada contrato paga R$1,00`
                }
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

        {/* Error Message */}
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
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-5 pt-0">
        <Button
          variant="default"
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card">
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
