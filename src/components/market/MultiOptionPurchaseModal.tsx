import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, RefreshCw, Coins, Info, AlertCircle, Zap } from 'lucide-react';
import { MarketEvent, MarketOption } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { optimizeImageUrl } from '@/lib/formatters';
import { PurchaseSuccessModal } from './PurchaseSuccessModal';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

const DEFAULT_SLIPPAGE = 0.05; // 5%

export function MultiOptionPurchaseModal({
  event,
  selectedOption,
  side,
  userBalance,
  onClose,
  onConfirm,
  onRefreshPrice,
}: MultiOptionPurchaseModalProps) {
  const [activeSide, setActiveSide] = useState<'YES' | 'NO'>(side);
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<MultiOptionQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const isMobile = useIsMobile();

  const yesPrice = selectedOption.currentPrice;
  const noPrice = 100 - selectedOption.currentPrice;
  const currentPrice = activeSide === 'YES' ? yesPrice : noPrice;

  const amountNum = parseFloat(amount) || 0;
  const maxAmount = Math.min(userBalance, event.limits.maxBuy);

  // Calculate shares from R$ amount
  const sharesFromAmount = useMemo(() => {
    if (amountNum <= 0 || currentPrice <= 0) return 0;
    return Math.floor(amountNum / (currentPrice / 100));
  }, [amountNum, currentPrice]);

  // Potential win
  const potentialWin = useMemo(() => {
    return sharesFromAmount > 0 ? sharesFromAmount * 1 : 0; // R$1 per winning contract
  }, [sharesFromAmount]);

  // Calculate quote
  useEffect(() => {
    if (sharesFromAmount <= 0) {
      setQuote(null);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(() => {
      if (activeSide === 'NO') {
        const noPriceDecimal = noPrice / 100;
        const cost = sharesFromAmount * noPriceDecimal;
        setQuote({
          cost,
          avgPrice: Math.round(noPriceDecimal * 100),
          priceImpact: 0,
          newPrices: [],
        });
        setIsLoading(false);
        return;
      }

      // YES: LMSR calculation
      const options = event.options || [];
      const lmsrB = event.lmsr?.b || 100;
      const currentShares = options.map(opt => opt.shares || 0);
      const optionIndex = options.findIndex(opt => opt.id === selectedOption.id);

      if (optionIndex === -1) {
        setQuote(null);
        setIsLoading(false);
        return;
      }

      const costFunction = (shares: number[]): number => {
        if (shares.length === 0) return 0;
        const scaledShares = shares.map(q => q / lmsrB);
        const maxVal = Math.max(...scaledShares);
        const sumExp = scaledShares.reduce((sum, x) => sum + Math.exp(x - maxVal), 0);
        return lmsrB * (maxVal + Math.log(sumExp));
      };

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
      const newShares = [...currentShares];
      newShares[optionIndex] += sharesFromAmount;
      const newCost = costFunction(newShares);
      const tradeCost = newCost - currentCost;
      const avgPrice = (tradeCost / sharesFromAmount) * 100;

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
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [sharesFromAmount, activeSide, noPrice, event.options, event.lmsr, selectedOption.id, currentPrice]);

  // Reset when switching side
  useEffect(() => {
    setAmount('');
    setError(null);
    setQuote(null);
  }, [activeSide]);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onRefreshPrice();
    } finally {
      setIsLoading(false);
    }
  }, [onRefreshPrice]);

  const handleConfirm = async () => {
    if (!quote || sharesFromAmount <= 0) {
      setError('Insira um valor válido.');
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
      const maxCost = quote.cost * (1 + DEFAULT_SLIPPAGE);
      await onConfirm(selectedOption.id, sharesFromAmount, maxCost, activeSide);

      setSuccessData({
        shares: sharesFromAmount,
        totalCost: quote.cost,
        potentialProfit: sharesFromAmount - quote.cost,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('preço mudou') || msg.includes('slippage') || msg.includes('Preço excedeu') || msg.includes('custo máximo')) {
        setError('O preço mudou. Tente novamente.');
        handleRefresh();
      } else {
        setError(msg || 'Erro ao processar compra. Tente novamente.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const quickBuyAmounts = [10, 50, 100];

  if (successData) {
    return (
      <PurchaseSuccessModal
        eventTitle={event.title}
        eventId={event.id}
        outcome={activeSide}
        optionLabel={selectedOption.label}
        shares={successData.shares}
        totalCost={successData.totalCost}
        potentialProfit={successData.potentialProfit}
        onClose={onClose}
      />
    );
  }

  const modalContent = (
    <div className="flex flex-col h-full">
      {/* Option Header */}
      <div className="px-5 pt-3 pb-2">
        <div className="flex items-center gap-3">
          {selectedOption.imageUrl ? (
            <div
              className="w-10 h-10 rounded-full bg-cover bg-center flex-shrink-0 border-2 border-border"
              style={{ backgroundImage: `url(${optimizeImageUrl(selectedOption.imageUrl, { width: 80 })})` }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0 text-lg">
              {selectedOption.label.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-base truncate">{selectedOption.label}</p>
            <p className={cn(
              "text-sm font-medium",
              activeSide === 'YES' ? "text-yes" : "text-no"
            )}>
              Comprar {activeSide === 'YES' ? 'Sim' : 'Não'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {/* SIM/NÃO Outcome Selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setActiveSide('YES')}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-colors duration-100",
              activeSide === 'YES'
                ? "bg-yes/10 border-yes text-yes"
                : "bg-card border-border hover:border-yes/50 text-muted-foreground"
            )}
          >
            <span className="text-lg font-bold">Sim</span>
            <span className={cn(
              "text-2xl font-mono font-bold",
              activeSide === 'YES' ? "text-yes" : "text-foreground"
            )}>
              {yesPrice}¢
            </span>
            {activeSide === 'YES' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yes rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSide('NO')}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-colors duration-100",
              activeSide === 'NO'
                ? "bg-no/10 border-no text-no"
                : "bg-card border-border hover:border-no/50 text-muted-foreground"
            )}
          >
            <span className="text-lg font-bold">Não</span>
            <span className={cn(
              "text-2xl font-mono font-bold",
              activeSide === 'NO' ? "text-no" : "text-foreground"
            )}>
              {noPrice}¢
            </span>
            {activeSide === 'NO' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-no rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </button>
        </div>

        {/* Amount Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Valor</label>
            <span className="text-xs text-muted-foreground">
              Saldo R${userBalance.toFixed(2)}
            </span>
          </div>

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
              className="h-14 text-2xl font-mono font-bold text-right pl-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Slider */}
          {maxAmount > 0 && (
            <Slider
              value={[amountNum]}
              min={0}
              max={Math.floor(maxAmount)}
              step={1}
              onValueChange={([val]) => setAmount(String(val))}
              className="py-2"
            />
          )}

          {/* Quick Buttons */}
          <div className="flex gap-2">
            {quickBuyAmounts.map((amt) => (
              <Button
                key={amt}
                variant="outline"
                size="sm"
                className="flex-1 font-mono"
                onClick={() => setAmount(String(amt))}
                disabled={amt > userBalance}
              >
                +R${amt}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 font-medium"
              onClick={() => setAmount(String(Math.floor(maxAmount)))}
            >
              Max
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-4 w-4" />
              Para ganhar
            </span>
            <span className={cn(
              "text-2xl font-mono font-bold",
              potentialWin > 0 ? "text-success" : "text-foreground"
            )}>
              R${potentialWin.toFixed(2)}
            </span>
          </div>

          {quote && sharesFromAmount > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                        Preço médio
                        <Info className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Preço médio por contrato considerando impacto no mercado</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-mono text-muted-foreground">
                  {(quote.avgPrice / 100).toFixed(2)}¢
                </span>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-mono font-bold">
                    R${quote.cost.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {sharesFromAmount} contratos × {(quote.avgPrice / 100).toFixed(2)}¢
                  </span>
                  {quote.cost > 0 && (
                    <span className="text-xs text-success">
                      +{(((potentialWin / quote.cost) - 1) * 100).toFixed(0)}% se vencer
                    </span>
                  )}
                </div>
              </div>

              {activeSide === 'YES' && Math.abs(quote.priceImpact) > 0.5 && (
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
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-5 pt-0 space-y-3">
        <Button
          variant={activeSide === 'YES' ? 'yes' : 'no'}
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleConfirm}
          disabled={isConfirming || isLoading || !quote || sharesFromAmount <= 0}
        >
          {isConfirming ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Processando...
            </>
          ) : quote ? (
            <>Comprar {activeSide === 'YES' ? 'Sim' : 'Não'} - R${quote.cost.toFixed(2)}</>
          ) : (
            <>Comprar {activeSide === 'YES' ? 'Sim' : 'Não'}</>
          )}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={true} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="flex items-center justify-between border-b border-border pb-3">
            <DrawerTitle className="text-lg font-semibold">
              {event.title.length > 40 ? event.title.slice(0, 40) + '...' : event.title}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          {modalContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-elevated animate-scale-in max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold line-clamp-1 pr-4">
            {event.title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {modalContent}
      </div>
    </div>
  );
}
