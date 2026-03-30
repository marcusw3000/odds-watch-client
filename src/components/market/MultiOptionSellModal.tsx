import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, RefreshCw, TrendingUp, TrendingDown, AlertCircle, Wallet } from 'lucide-react';
import { MarketEvent, UserContract } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { optimizeImageUrl } from '@/lib/formatters';
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
  DrawerClose,
} from '@/components/ui/drawer';

interface MultiOptionSellModalProps {
  event: MarketEvent;
  userContracts: UserContract[];
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

const SELL_SLIPPAGE = 0.02;

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
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<SellQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useIsMobile();

  const selectedContract = useMemo(
    () => userContracts.find((contract) => contract.id === selectedContractId),
    [userContracts, selectedContractId]
  );

  const selectedOption = useMemo(() => {
    if (!selectedContract?.optionId) return null;
    return event.options?.find((option) => option.id === selectedContract.optionId) ?? null;
  }, [selectedContract, event.options]);

  const sharesNum = parseFloat(amount) || 0;
  const maxShares = selectedContract?.quantity || 0;
  const contractType = selectedContract?.contractType === 'NO' ? 'NO' : 'YES';
  const contractLabel = contractType === 'NO' ? 'NAO' : 'SIM';
  const currentContractPrice = selectedOption
    ? contractType === 'NO'
      ? Math.max(1, 100 - selectedOption.currentPrice)
      : selectedOption.currentPrice
    : 0;

  useEffect(() => {
    if (!open) return;
    setSelectedContractId(userContracts[0]?.id || null);
    setAmount('');
    setError(null);
  }, [open, userContracts]);

  useEffect(() => {
    if (sharesNum <= 0 || !selectedOption || !event.options) {
      setQuote(null);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(() => {
      if (contractType === 'NO') {
        const noPrice = Math.max(1, 100 - selectedOption.currentPrice);
        const saleValue = (sharesNum * noPrice) / 100;

        setQuote({
          value: saleValue,
          avgPrice: noPrice,
          priceImpact: 0,
        });
        setIsLoading(false);
        return;
      }

      const options = event.options;
      const lmsrB = event.lmsr?.b || 100;
      const currentShares = options.map((option) => option.shares || 0);
      const optionIndex = options.findIndex((option) => option.id === selectedOption.id);

      if (optionIndex === -1) {
        setQuote(null);
        setIsLoading(false);
        return;
      }

      const costFunction = (shares: number[]): number => {
        if (shares.length === 0) return 0;
        const scaledShares = shares.map((shareCount) => shareCount / lmsrB);
        const maxVal = Math.max(...scaledShares);
        const sumExp = scaledShares.reduce((sum, value) => sum + Math.exp(value - maxVal), 0);
        return lmsrB * (maxVal + Math.log(sumExp));
      };

      const currentCost = costFunction(currentShares);
      const newShares = [...currentShares];
      newShares[optionIndex] = Math.max(0, newShares[optionIndex] - sharesNum);
      const newCost = costFunction(newShares);
      const saleValue = currentCost - newCost;
      const avgPrice = (saleValue / sharesNum) * 100;

      const scaledNew = newShares.map((shareCount) => shareCount / lmsrB);
      const maxValNew = Math.max(...scaledNew);
      const expValuesNew = scaledNew.map((value) => Math.exp(value - maxValNew));
      const sumExpNew = expValuesNew.reduce((sum, value) => sum + value, 0);
      const newPrice = Math.round((expValuesNew[optionIndex] / sumExpNew) * 100);
      const priceImpact =
        selectedOption.currentPrice > 0
          ? ((newPrice - selectedOption.currentPrice) / selectedOption.currentPrice) * 100
          : 0;

      setQuote({
        value: saleValue,
        avgPrice: Math.round(avgPrice),
        priceImpact,
      });
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [sharesNum, selectedOption, event.options, event.lmsr, contractType]);

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
    if (!selectedContract) {
      setError('Selecione um contrato para vender.');
      return;
    }

    if (!quote || sharesNum <= 0) {
      setError('Insira uma quantidade valida.');
      return;
    }

    if (sharesNum > maxShares) {
      setError(`Voce so possui ${maxShares} contratos.`);
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const minValue = quote.value * (1 - SELL_SLIPPAGE);
      await onConfirm(selectedContract.id, sharesNum, minValue);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('preco mudou') || msg.includes('slippage') || msg.includes('preço mudou')) {
        setError('O preco mudou. Tente novamente.');
        handleRefresh();
      } else {
        setError(msg || 'Erro ao processar venda. Tente novamente.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const sellPercentages = [25, 50, 75, 100];

  const profitLoss = useMemo(() => {
    if (!quote || !selectedContract || sharesNum <= 0) return null;
    const originalCost = (selectedContract.priceAtPurchase / 100) * sharesNum;
    const profit = quote.value - originalCost;
    const profitPct = originalCost > 0 ? (profit / originalCost) * 100 : 0;
    return { profit, profitPct };
  }, [quote, selectedContract, sharesNum]);

  const modalContent = (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {userContracts.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Selecione o contrato</p>
            <div className="flex gap-2 flex-wrap">
              {userContracts.map((contract) => {
                const option = event.options?.find((entry) => entry.id === contract.optionId);
                const chipLabel = `${contract.contractType === 'NO' ? 'NAO ' : ''}${option?.label || 'Opcao'}`;

                return (
                  <button
                    key={contract.id}
                    onClick={() => {
                      setSelectedContractId(contract.id);
                      setAmount('');
                    }}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                      selectedContractId === contract.id
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-muted/50 border-border hover:bg-muted'
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
                    <span className="font-medium">{chipLabel}</span>
                    <span className="text-xs text-muted-foreground">({contract.quantity})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedOption && selectedContract && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            {selectedOption.imageUrl ? (
              <div
                className="w-8 h-8 rounded-full bg-cover bg-center flex-shrink-0"
                style={{ backgroundImage: `url(${optimizeImageUrl(selectedOption.imageUrl, { width: 64 })})` }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0">
                {selectedOption.label.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                {contractType === 'NO' ? 'NAO ' : ''}
                {selectedOption.label}
              </p>
              <p className="text-xs text-muted-foreground">
                Contrato {contractLabel}: <span className="font-mono">{currentContractPrice}¢</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span className="font-mono font-bold">{selectedContract.quantity}</span>
              </div>
              <p className="text-xs text-muted-foreground">contratos</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Contratos</label>
            <span className="text-xs text-muted-foreground">Disponivel: {maxShares}</span>
          </div>

          <Input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            placeholder="Quantidade"
            max={maxShares}
            className="h-14 text-2xl font-mono font-bold text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />

          <div className="flex gap-2">
            {sellPercentages.map((pct) => (
              <Button
                key={pct}
                variant="outline"
                size="sm"
                className="flex-1 font-mono"
                onClick={() => {
                  const contracts = pct === 100 ? maxShares : Math.floor((maxShares * pct) / 100);
                  setAmount(String(Math.max(1, contracts)));
                }}
                disabled={maxShares === 0}
              >
                {pct === 100 ? 'Tudo' : `${pct}%`}
              </Button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-3">
          {quote && sharesNum > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Voce recebera
                </span>
                <span className="text-2xl font-mono font-bold text-success">
                  R${quote.value.toFixed(2)}
                </span>
              </div>

              {profitLoss && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    {profitLoss.profit >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    Resultado
                  </span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      profitLoss.profit >= 0 ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {profitLoss.profit >= 0 ? '+' : ''}
                    R${profitLoss.profit.toFixed(2)} ({profitLoss.profitPct.toFixed(1)}%)
                  </span>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Contratos a vender</span>
                  <span className="font-mono font-medium">
                    {sharesNum} de {maxShares}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Preco medio de venda</span>
                  <span className="font-mono text-muted-foreground">
                    R${(quote.avgPrice / 100).toFixed(2)} cada
                  </span>
                </div>
              </div>

              {Math.abs(quote.priceImpact) > 0.5 && (
                <p className="text-xs text-muted-foreground">
                  Impacto no preco: {quote.priceImpact.toFixed(2)}%
                </p>
              )}
            </>
          ) : maxShares === 0 ? (
            <div className="p-4 rounded-lg bg-muted/30 border border-dashed border-border text-center">
              <p className="text-sm text-muted-foreground">Voce nao possui contratos para vender</p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-sm text-muted-foreground">
                Selecione a quantidade de contratos para vender
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="p-5 pt-0 space-y-3">
        <Button
          variant="destructive"
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleConfirm}
          disabled={isConfirming || isLoading || !quote || sharesNum <= 0 || sharesNum > maxShares}
        >
          {isConfirming ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Processando...
            </>
          ) : quote ? (
            <>Vender - R${quote.value.toFixed(2)}</>
          ) : (
            <>Vender</>
          )}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="flex items-center justify-between border-b border-border pb-3">
            <DrawerTitle className="text-lg font-semibold">Vender Contratos</DrawerTitle>
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
