import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { MarketEvent, UserContract } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { TradeQuote } from '@/services/LMSRCalculator';
import { PurchaseSuccessModal } from './PurchaseSuccessModal';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface MinimalTradingCardProps {
  event: MarketEvent;
  userBalance: number;
  userContracts?: UserContract[];
  initialOutcome?: 'YES' | 'NO';
  onClose: () => void;
  onBuyConfirm: (outcome: 'YES' | 'NO', shares: number, maxCost: number) => Promise<void>;
  onSellConfirm?: (contractId: string, minValue: number) => Promise<void>;
}

interface SuccessData {
  mode: 'buy' | 'sell';
  shares: number;
  totalValue: number;
  potentialProfit: number;
  outcome: 'YES' | 'NO';
}

const DEFAULT_SLIPPAGE = 0.05;
const SELL_SLIPPAGE = 0.02;

export function MinimalTradingCard({
  event,
  userBalance,
  userContracts = [],
  initialOutcome = 'YES',
  onClose,
  onBuyConfirm,
  onSellConfirm,
}: MinimalTradingCardProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [activeOutcome, setActiveOutcome] = useState<'YES' | 'NO'>(initialOutcome);
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const isMobile = useIsMobile();

  // User contracts for this market
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

  // Prices (convert from decimal to cents display)
  const yesPrice = Math.round(event.outcomes.YES.price);
  const noPrice = Math.round(event.outcomes.NO.price);
  const currentPrice = activeOutcome === 'YES' ? yesPrice : noPrice;

  // Calculate shares from amount
  const amountNum = parseFloat(amount) || 0;
  const sharesFromAmount = useMemo(() => {
    if (mode === 'buy') {
      return amountNum > 0 ? Math.floor(amountNum / (currentPrice / 100)) : 0;
    }
    return amountNum; // For sell, amount IS contracts
  }, [amountNum, currentPrice, mode]);

  // Potential win (R$1 per winning contract)
  const potentialWin = useMemo(() => {
    if (mode === 'buy' && sharesFromAmount > 0) {
      return sharesFromAmount;
    }
    return 0;
  }, [mode, sharesFromAmount]);

  // Fetch quote
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
        } else if (onSellConfirm) {
          const newQuote = await MarketDataProvider.getSellQuote(event.id, activeOutcome, sharesFromAmount);
          setQuote(newQuote);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchQuote, 300);
    return () => clearTimeout(timer);
  }, [sharesFromAmount, event.id, activeOutcome, mode, onSellConfirm]);

  // Reset on mode/outcome change
  useEffect(() => {
    setAmount('');
    setError(null);
    setQuote(null);
  }, [mode, activeOutcome]);

  const handleConfirm = useCallback(async () => {
    if (!quote || sharesFromAmount <= 0) {
      setError('Insira um valor válido.');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      if (mode === 'buy') {
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
      } else if (onSellConfirm && currentContract) {
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
      const msg = err instanceof Error ? err.message : 'Erro ao processar.';
      setError(msg);
    } finally {
      setIsConfirming(false);
    }
  }, [quote, sharesFromAmount, mode, userBalance, onBuyConfirm, onSellConfirm, activeOutcome, currentContract, currentQuantity]);

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

  const hasSellableContracts = yesQuantity > 0 || noQuantity > 0;

  const modalContent = (
    <div className="flex flex-col">
      {/* Compact Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {event.imageUrl && (
          <img 
            src={event.imageUrl} 
            alt="" 
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0" 
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-1">{event.title}</p>
          <p className="text-xs text-primary">
            {mode === 'buy' ? 'Comprar' : 'Vender'} {activeOutcome === 'YES' ? 'Sim' : 'Não'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Mode Tabs */}
        {hasSellableContracts && onSellConfirm && (
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
            <button
              onClick={() => setMode('buy')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
                mode === 'buy' 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Comprar
            </button>
            <button
              onClick={() => setMode('sell')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
                mode === 'sell' 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Vender
            </button>
          </div>
        )}

        {/* Outcome Buttons - Compact Kalshi Style */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveOutcome('YES')}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl font-bold text-center transition-all border-2",
              activeOutcome === 'YES'
                ? "bg-yes text-yes-foreground border-yes"
                : "bg-card border-border hover:border-yes/50 text-foreground"
            )}
          >
            Sim {yesPrice}¢
          </button>
          <button
            onClick={() => setActiveOutcome('NO')}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl font-bold text-center transition-all border-2",
              activeOutcome === 'NO'
                ? "bg-no text-no-foreground border-no"
                : "bg-card border-border hover:border-no/50 text-foreground"
            )}
          >
            Não {noPrice}¢
          </button>
        </div>

        {/* Amount Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">
              {mode === 'buy' ? 'Valor' : 'Contratos'}
            </span>
            <span className="text-xs text-muted-foreground">
              {mode === 'buy' 
                ? `Saldo: R$${userBalance.toFixed(2)}`
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
              placeholder="0"
              className={cn(
                "h-14 text-2xl font-mono font-bold text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                mode === 'buy' && "pl-12"
              )}
            />
          </div>
        </div>

        {/* Potential Win (Buy) or Receive (Sell) */}
        {sharesFromAmount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {mode === 'buy' ? 'Para ganhar' : 'Você receberá'}
            </span>
            <span className={cn(
              "text-xl font-mono font-bold",
              mode === 'buy' ? "text-success" : "text-foreground"
            )}>
              R${mode === 'buy' ? potentialWin.toFixed(2) : (quote?.cost || 0).toFixed(2)}
            </span>
          </div>
        )}

        {/* Collapsible Details */}
        {quote && sharesFromAmount > 0 && (
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto">
              {showDetails ? 'Ocultar' : 'Mais'} detalhes
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 p-3 rounded-lg bg-muted/30 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contratos</span>
                  <span className="font-mono">{sharesFromAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço médio</span>
                  <span className="font-mono">{(quote.avgPrice / 100).toFixed(2)}¢</span>
                </div>
                {mode === 'buy' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custo total</span>
                    <span className="font-mono">R${quote.cost.toFixed(2)}</span>
                  </div>
                )}
                {Math.abs(quote.priceImpact) > 0.5 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Impacto no preço</span>
                    <span className={cn(
                      "font-mono",
                      quote.priceImpact > 3 ? "text-warning" : "text-muted-foreground"
                    )}>
                      {quote.priceImpact > 0 ? '+' : ''}{quote.priceImpact.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {/* Action Button */}
        <Button
          variant={activeOutcome === 'YES' ? 'yes' : 'no'}
          size="lg"
          className="w-full h-12"
          onClick={handleConfirm}
          disabled={isConfirming || !quote || sharesFromAmount <= 0 || isLoading}
        >
          {isConfirming ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            `${mode === 'buy' ? 'Comprar' : 'Vender'} ${activeOutcome === 'YES' ? 'Sim' : 'Não'}`
          )}
        </Button>
      </div>
    </div>
  );

  // Mobile: use Drawer
  if (isMobile) {
    return (
      <Drawer open={true} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerClose className="sr-only">Close</DrawerClose>
          {modalContent}
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: fixed modal
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in-0 zoom-in-95">
        {modalContent}
      </div>
    </div>
  );
}
