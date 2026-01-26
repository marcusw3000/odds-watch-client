import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, AlertCircle, RefreshCw, Clock, TrendingUp, TrendingDown, Calculator, Wallet } from 'lucide-react';
import { MarketEvent, MarketOption, UserContract } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { optimizeImageUrl } from '@/lib/formatters';
import { SlippageSelector } from './SlippageSelector';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface MultiOptionSellModalProps {
  event: MarketEvent;
  userContracts: UserContract[];  // Filtered to OPTION contracts only
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (contractId: string, shares: number, minValue: number) => Promise<void>;
  onRefreshPrice: () => Promise<MarketEvent | null>;
}

interface SellQuote {
  value: number;
  avgPrice: number;
  priceImpact: number;
}

const PRICE_VALIDITY_SECONDS = 15;

export function MultiOptionSellModal({
  event,
  userContracts,
  open,
  onOpenChange,
  onConfirm,
  onRefreshPrice,
}: MultiOptionSellModalProps) {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    userContracts[0]?.id || null
  );
  const [sharesToSell, setSharesToSell] = useState<string>('');
  const [quote, setQuote] = useState<SellQuote | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(PRICE_VALIDITY_SECONDS);
  const [priceExpired, setPriceExpired] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slippageTolerance, setSlippageTolerance] = useState(0.05);
  
  const isMobile = useIsMobile();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedContract = useMemo(() => 
    userContracts.find(c => c.id === selectedContractId),
    [userContracts, selectedContractId]
  );

  const selectedOption = useMemo(() => {
    if (!selectedContract?.optionId) return null;
    return event.options?.find(o => o.id === selectedContract.optionId);
  }, [selectedContract, event.options]);

  const sharesNum = parseFloat(sharesToSell) || 0;
  const debouncedShares = useDebouncedValue(sharesNum, 300);
  const maxShares = selectedContract?.quantity || 0;

  // Calculate sell quote using LMSR multi-option formula
  useEffect(() => {
    if (debouncedShares <= 0 || !selectedOption || !event.options) {
      setQuote(null);
      return;
    }

    const options = event.options;
    const lmsrB = event.lmsr?.b || 100;
    
    // Get current shares from options
    const currentShares = options.map(opt => opt.shares || 0);
    const optionIndex = options.findIndex(opt => opt.id === selectedOption.id);
    
    if (optionIndex === -1) {
      setQuote(null);
      return;
    }

    // LMSR cost function: C(q) = b * ln(Σ e^(qi/b))
    const costFunction = (shares: number[]): number => {
      if (shares.length === 0) return 0;
      const scaledShares = shares.map(q => q / lmsrB);
      const maxVal = Math.max(...scaledShares);
      const sumExp = scaledShares.reduce((sum, x) => sum + Math.exp(x - maxVal), 0);
      return lmsrB * (maxVal + Math.log(sumExp));
    };

    const currentCost = costFunction(currentShares);
    
    // Calculate new shares after selling
    const newShares = [...currentShares];
    newShares[optionIndex] = Math.max(0, newShares[optionIndex] - debouncedShares);
    
    const newCost = costFunction(newShares);
    const saleValue = currentCost - newCost;
    const avgPrice = (saleValue / debouncedShares) * 100;
    
    // Calculate price impact
    const currentPrice = selectedOption.currentPrice;
    const scaledNew = newShares.map(q => q / lmsrB);
    const maxValNew = Math.max(...scaledNew);
    const expValuesNew = scaledNew.map(x => Math.exp(x - maxValNew));
    const sumExpNew = expValuesNew.reduce((sum, x) => sum + x, 0);
    const newPrice = Math.round((expValuesNew[optionIndex] / sumExpNew) * 100);
    const priceImpact = currentPrice > 0 ? ((newPrice - currentPrice) / currentPrice) * 100 : 0;
    
    setQuote({
      value: saleValue,
      avgPrice: Math.round(avgPrice),
      priceImpact,
    });
  }, [debouncedShares, selectedOption, event.options, event.lmsr]);

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

  // Reset timer when modal opens or contract changes
  useEffect(() => {
    if (open) {
      setTimeRemaining(PRICE_VALIDITY_SECONDS);
      setPriceExpired(false);
      setSharesToSell('');
      setError(null);
    }
  }, [open, selectedContractId]);

  const handleRefreshPrice = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    
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
    if (!selectedContract) {
      setError('Selecione um contrato para vender.');
      return;
    }

    if (priceExpired) {
      setError('Preço expirado. Atualize antes de confirmar.');
      return;
    }

    if (!quote || sharesNum <= 0) {
      setError('Insira uma quantidade válida.');
      return;
    }

    if (sharesNum > maxShares) {
      setError(`Você só possui ${maxShares} contratos.`);
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const minValueWithSlippage = quote.value * (1 - slippageTolerance);
      await onConfirm(selectedContract.id, sharesNum, minValueWithSlippage);
      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '';
      
      if (errorMessage.includes('preço mudou') || errorMessage.includes('slippage')) {
        setError('O preço mudou desde sua cotação. Atualize e tente novamente.');
        handleRefreshPrice();
      } else {
        setError(errorMessage || 'Erro ao processar venda. Tente novamente.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const quickPercents = [25, 50, 75, 100];

  // Calculate profit/loss based on average purchase price
  const profitLoss = useMemo(() => {
    if (!quote || !selectedContract || sharesNum <= 0) return null;
    
    const originalCost = (selectedContract.priceAtPurchase / 100) * sharesNum;
    const saleValue = quote.value;
    const profit = saleValue - originalCost;
    const profitPercent = originalCost > 0 ? (profit / originalCost) * 100 : 0;
    
    return { profit, profitPercent };
  }, [quote, selectedContract, sharesNum]);

  const modalContent = (
    <>
      <div className="p-5 space-y-5">
        {/* Event Title */}
        <div className="p-4 rounded-lg bg-secondary">
          <p className="text-sm text-muted-foreground mb-1">Evento</p>
          <p className="font-medium leading-snug">{event.title}</p>
        </div>

        {/* Contract Selection */}
        {userContracts.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Selecione o contrato</p>
            <div className="flex gap-2 flex-wrap">
              {userContracts.map(contract => {
                const option = event.options?.find(o => o.id === contract.optionId);
                return (
                  <button
                    key={contract.id}
                    onClick={() => {
                      setSelectedContractId(contract.id);
                      setSharesToSell('');
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                      selectedContractId === contract.id 
                        ? "bg-primary/20 border-primary text-primary" 
                        : "bg-muted/50 border-border hover:bg-muted"
                    )}
                  >
                    {option?.imageUrl ? (
                      <div 
                        className="w-6 h-6 rounded-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, { width: 48 })})` }}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                        {option?.label.charAt(0) || '?'}
                      </div>
                    )}
                    <span className="font-medium">{option?.label || 'Opção'}</span>
                    <span className="text-xs text-muted-foreground">({contract.quantity})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Option Info */}
        {selectedOption && selectedContract && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Vendendo</p>
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
                <span className="px-3 py-1.5 rounded-lg font-bold text-lg bg-primary/20 text-primary">
                  {selectedOption.label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Preço atual</p>
              <span className={cn(
                "text-2xl font-bold text-primary",
                isRefreshing && "animate-pulse"
              )}>
                {selectedOption.currentPrice}¢
              </span>
            </div>
          </div>
        )}

        {/* Position Info */}
        {selectedContract && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">Sua posição: </span>
              <span className="font-mono font-bold">{selectedContract.quantity}</span>
              <span className="text-sm text-muted-foreground"> contratos</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Custo médio: <span className="font-mono">{selectedContract.priceAtPurchase}¢</span>
            </div>
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
            Quantidade para vender
          </label>
          <Input
            type="number"
            value={sharesToSell}
            onChange={(e) => {
              setSharesToSell(e.target.value);
              setError(null);
            }}
            placeholder="Quantos contratos vender?"
            max={maxShares}
            className="h-12 text-lg font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <div className="flex gap-2 mt-3">
            {quickPercents.map((pct) => (
              <Button
                key={pct}
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const amount = Math.floor((maxShares * pct) / 100);
                  setSharesToSell(String(amount));
                }}
              >
                {pct === 100 ? 'Tudo' : `${pct}%`}
              </Button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {quote && sharesNum > 0 && (
          <div className="p-4 rounded-lg bg-gradient-card border border-border space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calculator className="h-4 w-4" />
              Resumo da venda
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contratos a vender</span>
                <span className="font-mono font-medium">{sharesNum} de {maxShares}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preço médio de venda</span>
                <span className="font-mono font-medium">R${(quote.avgPrice / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex justify-between items-center">
                <span className="font-medium">Você receberá</span>
                <span className="font-mono text-lg font-bold text-foreground">
                  R${quote.value.toFixed(2)}
                </span>
              </div>
            </div>

            {profitLoss && (
              <div className={cn(
                "flex items-center justify-between p-2 rounded-md",
                profitLoss.profit >= 0 
                  ? "bg-success/10 text-success" 
                  : "bg-destructive/10 text-destructive"
              )}>
                <div className="flex items-center gap-2">
                  {profitLoss.profit >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
                    {profitLoss.profit >= 0 ? 'Lucro' : 'Prejuízo'}
                  </span>
                </div>
                <span className="font-mono font-bold">
                  {profitLoss.profit >= 0 ? '+' : ''}{profitLoss.profit.toFixed(2)} ({profitLoss.profitPercent.toFixed(1)}%)
                </span>
              </div>
            )}

            {Math.abs(quote.priceImpact) > 0.5 && (
              <p className="text-xs text-muted-foreground">
                Impacto no preço: {quote.priceImpact.toFixed(2)}%
              </p>
            )}

            <div className="flex items-center justify-center">
              <SlippageSelector 
                value={slippageTolerance} 
                onChange={setSlippageTolerance}
                disabled={isConfirming}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-destructive/10 border border-destructive/30 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-5 pt-0">
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          onClick={handleConfirm}
          disabled={
            isConfirming || 
            priceExpired || 
            !quote || 
            sharesNum <= 0 || 
            sharesNum > maxShares
          }
        >
          {isConfirming ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>Confirmar Venda</>
          )}
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b border-border px-5 py-4">
            <DrawerTitle>Vender Contratos</DrawerTitle>
            <DrawerClose className="absolute right-4 top-4" />
          </DrawerHeader>
          <div className="overflow-y-auto flex-1">
            {modalContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Vender Contratos</DialogTitle>
        </DialogHeader>
        {modalContent}
      </DialogContent>
    </Dialog>
  );
}
