import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, RefreshCw, Coins, Info, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { MarketEvent, UserContract } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { TradeQuote } from '@/services/LMSRCalculator';
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

interface TradingModalProps {
  event: MarketEvent;
  userBalance: number;
  userContracts: UserContract[];
  initialMode: 'buy' | 'sell';
  initialOutcome?: 'YES' | 'NO';
  onClose: () => void;
  onBuyConfirm: (outcome: 'YES' | 'NO', shares: number, maxCost: number) => Promise<void>;
  onSellConfirm: (contractId: string, minValue: number) => Promise<void>;
  onRefreshPrice: () => Promise<MarketEvent | null>;
}

interface SuccessData {
  mode: 'buy' | 'sell';
  shares: number;
  totalValue: number;
  potentialProfit: number;
  outcome: 'YES' | 'NO';
}

const DEFAULT_SLIPPAGE = 0.05; // 5%
const SELL_SLIPPAGE = 0.02; // 2%

export function TradingModal({
  event,
  userBalance,
  userContracts,
  initialMode,
  initialOutcome,
  onClose,
  onBuyConfirm,
  onSellConfirm,
  onRefreshPrice,
}: TradingModalProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>(initialMode);
  const [activeOutcome, setActiveOutcome] = useState<'YES' | 'NO'>(initialOutcome || 'YES');
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const isMobile = useIsMobile();

  // Get user's contracts for current market
  const yesContract = useMemo(() => 
    userContracts.find(c => c.eventId === event.id && c.outcome === 'YES'),
    [userContracts, event.id]
  );
  const noContract = useMemo(() => 
    userContracts.find(c => c.eventId === event.id && c.outcome === 'NO'),
    [userContracts, event.id]
  );

  const yesQuantity = yesContract?.quantity || 0;
  const noQuantity = noContract?.quantity || 0;

  const currentContract = activeOutcome === 'YES' ? yesContract : noContract;
  const currentQuantity = activeOutcome === 'YES' ? yesQuantity : noQuantity;

  // Prices
  const yesPrice = event.outcomes.YES.price;
  const noPrice = event.outcomes.NO.price;
  const currentPrice = activeOutcome === 'YES' ? yesPrice : noPrice;

  // Calculate shares from amount (for buy mode)
  const amountNum = parseFloat(amount) || 0;
  const sharesFromAmount = useMemo(() => {
    if (mode === 'buy') {
      return amountNum > 0 ? Math.floor(amountNum / (currentPrice / 100)) : 0;
    }
    return amountNum; // For sell, amount IS the number of contracts
  }, [amountNum, currentPrice, mode]);

  // Potential win calculation (buy mode)
  const potentialWin = useMemo(() => {
    if (mode === 'buy' && sharesFromAmount > 0) {
      return sharesFromAmount * 1; // R$1 per winning contract
    }
    return 0;
  }, [mode, sharesFromAmount]);

  // Fetch quote when parameters change
  useEffect(() => {
    if (sharesFromAmount <= 0) {
      setQuote(null);
      return;
    }

    const fetchQuote = async () => {
      setIsLoading(true);
      try {
        if (mode === 'buy') {
          const newQuote = await MarketDataProvider.getQuote(event.id, activeOutcome, sharesFromAmount);
          setQuote(newQuote);
        } else {
          const newQuote = await MarketDataProvider.getSellQuote(event.id, activeOutcome, sharesFromAmount);
          setQuote(newQuote);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchQuote, 300);
    return () => clearTimeout(timer);
  }, [sharesFromAmount, event.id, activeOutcome, mode]);

  // Reset amount when switching mode or outcome
  useEffect(() => {
    setAmount('');
    setError(null);
    setQuote(null);
  }, [mode, activeOutcome]);

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

    setIsConfirming(true);
    setError(null);

    try {
      if (mode === 'buy') {
        // Validate buy
        if (quote.cost < event.limits.minBuy) {
          setError(`Valor mínimo: R$${event.limits.minBuy}`);
          setIsConfirming(false);
          return;
        }
        if (quote.cost > event.limits.maxBuy) {
          setError(`Valor máximo: R$${event.limits.maxBuy}`);
          setIsConfirming(false);
          return;
        }
        if (quote.cost > userBalance) {
          setError('Saldo insuficiente.');
          setIsConfirming(false);
          return;
        }

        const maxCost = quote.cost * (1 + DEFAULT_SLIPPAGE);
        await onBuyConfirm(activeOutcome, sharesFromAmount, maxCost);

        setSuccessData({
          mode: 'buy',
          shares: sharesFromAmount,
          totalValue: quote.cost,
          potentialProfit: sharesFromAmount - quote.cost,
          outcome: activeOutcome,
        });
      } else {
        // Validate sell
        if (!currentContract) {
          setError('Você não possui contratos deste tipo.');
          setIsConfirming(false);
          return;
        }
        if (sharesFromAmount > currentQuantity) {
          setError(`Você tem apenas ${currentQuantity} contratos.`);
          setIsConfirming(false);
          return;
        }

        const minValue = quote.cost * (1 - SELL_SLIPPAGE);
        await onSellConfirm(currentContract.id, minValue);

        const costBasis = (currentContract.priceAtPurchase / 100) * sharesFromAmount;
        setSuccessData({
          mode: 'sell',
          shares: sharesFromAmount,
          totalValue: quote.cost,
          potentialProfit: quote.cost - costBasis,
          outcome: activeOutcome,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar. Tente novamente.';
      if (msg.includes('slippage') || msg.includes('preço')) {
        setError('O preço mudou. Tente novamente.');
        handleRefresh();
      } else {
        setError(msg);
      }
    } finally {
      setIsConfirming(false);
    }
  };

  // Quick amount buttons
  const quickBuyAmounts = [10, 50, 100];
  const maxBuyAmount = Math.min(userBalance, event.limits.maxBuy);

  // Sell percentage buttons
  const sellPercentages = [25, 50, 75, 100];

  const handleQuickBuy = (amt: number) => {
    setAmount(String(amt));
  };

  const handleMaxBuy = () => {
    setAmount(String(Math.floor(maxBuyAmount)));
  };

  const handleSellPercentage = (pct: number) => {
    const contracts = Math.floor((currentQuantity * pct) / 100);
    setAmount(String(Math.max(1, contracts)));
  };

  // Profit/Loss calculation for sell (moved BEFORE early return)
  const sellProfitLoss = useMemo(() => {
    if (mode !== 'sell' || !quote || !currentContract) return null;
    const costBasis = (currentContract.priceAtPurchase / 100) * sharesFromAmount;
    const profit = quote.cost - costBasis;
    const profitPct = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    return { profit, profitPct };
  }, [mode, quote, currentContract, sharesFromAmount]);

  // Show success modal
  if (successData) {
    return (
      <PurchaseSuccessModal
        eventTitle={event.title}
        eventId={event.id}
        outcome={successData.outcome}
        shares={successData.shares}
        totalCost={successData.totalValue}
        potentialProfit={successData.potentialProfit}
        onClose={onClose}
      />
    );
  }

  const modalContent = (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-5 pt-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'buy' | 'sell')}>
          <TabsList className="w-full grid grid-cols-2 bg-muted/50">
            <TabsTrigger value="buy" className="font-semibold">
              Comprar
            </TabsTrigger>
            <TabsTrigger value="sell" className="font-semibold">
              Vender
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {/* Outcome Selector */}
        <div className="grid grid-cols-2 gap-3">
          {/* YES Button */}
          <button
            type="button"
            onClick={() => setActiveOutcome('YES')}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-colors duration-100",
              activeOutcome === 'YES'
                ? "bg-yes/10 border-yes text-yes"
                : "bg-card border-border hover:border-yes/50 text-muted-foreground"
            )}
          >
            <span className="text-lg font-bold">Sim</span>
            <span className={cn(
              "text-2xl font-mono font-bold",
              activeOutcome === 'YES' ? "text-yes" : "text-foreground"
            )}>
              {yesPrice}¢
            </span>
            {mode === 'sell' && yesQuantity > 0 && (
              <span className="text-xs mt-1 text-muted-foreground">
                Você tem: {yesQuantity}
              </span>
            )}
            {activeOutcome === 'YES' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yes rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </button>

          {/* NO Button */}
          <button
            type="button"
            onClick={() => setActiveOutcome('NO')}
            className={cn(
              "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-colors duration-100",
              activeOutcome === 'NO'
                ? "bg-no/10 border-no text-no"
                : "bg-card border-border hover:border-no/50 text-muted-foreground"
            )}
          >
            <span className="text-lg font-bold">Não</span>
            <span className={cn(
              "text-2xl font-mono font-bold",
              activeOutcome === 'NO' ? "text-no" : "text-foreground"
            )}>
              {noPrice}¢
            </span>
            {mode === 'sell' && noQuantity > 0 && (
              <span className="text-xs mt-1 text-muted-foreground">
                Você tem: {noQuantity}
              </span>
            )}
            {activeOutcome === 'NO' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-no rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </button>
        </div>

        {/* Amount Input Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">
              {mode === 'buy' ? 'Valor' : 'Contratos'}
            </label>
            <span className="text-xs text-muted-foreground">
              {mode === 'buy' 
                ? `Saldo R$${userBalance.toFixed(2)}`
                : `Disponível: ${currentQuantity}`
              }
            </span>
          </div>

          <div className="relative">
            {mode === 'buy' && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                R$
              </span>
            )}
            <Input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder={mode === 'buy' ? '0' : 'Quantidade'}
              className={cn(
                "h-14 text-2xl font-mono font-bold text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                mode === 'buy' && "pl-12"
              )}
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="flex gap-2">
            {mode === 'buy' ? (
              <>
                {quickBuyAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    className="flex-1 font-mono"
                    onClick={() => handleQuickBuy(amt)}
                    disabled={amt > userBalance}
                  >
                    +R${amt}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 font-medium"
                  onClick={handleMaxBuy}
                >
                  Max
                </Button>
              </>
            ) : (
              <>
                {sellPercentages.map((pct) => (
                  <Button
                    key={pct}
                    variant="outline"
                    size="sm"
                    className="flex-1 font-mono"
                    onClick={() => handleSellPercentage(pct)}
                    disabled={currentQuantity === 0}
                  >
                    {pct}%
                  </Button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Summary Section */}
        {mode === 'buy' ? (
          // Buy Summary
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
            )}

            {quote && sharesFromAmount > 0 && (
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
                  <span className="text-xs text-success">
                    +{(((potentialWin / quote.cost) - 1) * 100).toFixed(0)}% se vencer
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Sell Summary
          <div className="space-y-3">
            {quote && sharesFromAmount > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    Você receberá
                  </span>
                  <span className="text-2xl font-mono font-bold text-success">
                    R${quote.cost.toFixed(2)}
                  </span>
                </div>

                {sellProfitLoss && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      {sellProfitLoss.profit >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                      Resultado
                    </span>
                    <span className={cn(
                      "font-mono font-bold",
                      sellProfitLoss.profit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {sellProfitLoss.profit >= 0 ? '+' : ''}
                      R${sellProfitLoss.profit.toFixed(2)} ({sellProfitLoss.profitPct.toFixed(1)}%)
                    </span>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Contratos a vender</span>
                    <span className="font-mono font-medium">{sharesFromAmount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Preço de venda</span>
                    <span className="font-mono text-muted-foreground">
                      {(quote.avgPrice / 100).toFixed(2)}¢ cada
                    </span>
                  </div>
                </div>
              </>
            ) : currentQuantity === 0 ? (
              <div className="p-4 rounded-lg bg-muted/30 border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground">
                  Você não possui contratos {activeOutcome === 'YES' ? 'SIM' : 'NÃO'} deste mercado
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-muted/30 border border-border text-center">
                <p className="text-sm text-muted-foreground">
                  Selecione a quantidade de contratos para vender
                </p>
              </div>
            )}
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
      <div className="p-5 pt-0 space-y-3">
        <Button
          variant={activeOutcome === 'YES' ? 'yes' : 'no'}
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleConfirm}
          disabled={
            isConfirming || 
            isLoading || 
            !quote || 
            sharesFromAmount <= 0 ||
            (mode === 'sell' && currentQuantity === 0)
          }
        >
          {isConfirming ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Processando...
            </>
          ) : mode === 'buy' ? (
            quote ? (
              <>Comprar {activeOutcome === 'YES' ? 'Sim' : 'Não'} - R${quote.cost.toFixed(2)}</>
            ) : (
              <>Comprar {activeOutcome === 'YES' ? 'Sim' : 'Não'}</>
            )
          ) : (
            quote ? (
              <>Vender {activeOutcome === 'YES' ? 'Sim' : 'Não'} - R${quote.cost.toFixed(2)}</>
            ) : (
              <>Vender {activeOutcome === 'YES' ? 'Sim' : 'Não'}</>
            )
          )}
        </Button>
      </div>
    </div>
  );

  // Mobile: Drawer
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

  // Desktop: Modal
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-elevated animate-scale-in max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
