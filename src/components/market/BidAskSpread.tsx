import { useState, useEffect, useCallback } from 'react';
import { Info, TrendingDown, AlertTriangle } from 'lucide-react';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { TradeQuote } from '@/services/LMSRCalculator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BidAskSpreadProps {
  eventId: string;
  quantity?: number;
  yesShares?: number;
  noShares?: number;
}

interface QuotePair {
  buy: TradeQuote | null;
  sell: TradeQuote | null;
}

const QUANTITY_OPTIONS = [1, 10, 25, 50, 100];

export function BidAskSpread({ eventId, quantity = 10, yesShares, noShares }: BidAskSpreadProps) {
  const [selectedQty, setSelectedQty] = useState(quantity);
  const [yesQuotes, setYesQuotes] = useState<QuotePair>({ buy: null, sell: null });
  const [noQuotes, setNoQuotes] = useState<QuotePair>({ buy: null, sell: null });
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuotes = useCallback(async (qty: number) => {
    setIsLoading(true);
    try {
      const [yesBuy, yesSell, noBuy, noSell] = await Promise.all([
        MarketDataProvider.getQuote(eventId, 'YES', qty),
        MarketDataProvider.getSellQuote(eventId, 'YES', qty),
        MarketDataProvider.getQuote(eventId, 'NO', qty),
        MarketDataProvider.getSellQuote(eventId, 'NO', qty),
      ]);
      setYesQuotes({ buy: yesBuy, sell: yesSell });
      setNoQuotes({ buy: noBuy, sell: noSell });
    } catch (error) {
      console.error('Error fetching bid/ask quotes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchQuotes(selectedQty);
  }, [selectedQty, fetchQuotes]);

  const calculateSpread = (buyQuote: TradeQuote | null, sellQuote: TradeQuote | null) => {
    if (!buyQuote || !sellQuote) return null;
    const buyPrice = buyQuote.avgPrice / 100;
    const sellPrice = sellQuote.avgPrice / 100;
    if (buyPrice === 0) return null;
    return ((buyPrice - sellPrice) / buyPrice * 100).toFixed(2);
  };

  const yesSpread = calculateSpread(yesQuotes.buy, yesQuotes.sell);
  const noSpread = calculateSpread(noQuotes.buy, noQuotes.sell);

  const hasLowLiquidityYes = yesShares !== undefined && yesShares < selectedQty;
  const hasLowLiquidityNo = noShares !== undefined && noShares < selectedQty;

  if (isLoading) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <div className="flex gap-1 mb-3">
          {QUANTITY_OPTIONS.slice(0, 4).map((_, i) => (
            <Skeleton key={i} className="h-7 flex-1" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="font-medium">Spread de Negociação</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[240px]">
            <div className="text-xs space-y-2">
              <p className="font-medium">O que é Spread?</p>
              <p>
                Diferença entre preço de compra e venda. O spread existe porque 
                ordens maiores impactam o preço de mercado (LMSR).
              </p>
              <p className="text-muted-foreground">
                Quanto maior a ordem, maior o impacto no preço.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Quantity Selector */}
      <div className="flex gap-1">
        {QUANTITY_OPTIONS.map((qty) => (
          <Button
            key={qty}
            variant={selectedQty === qty ? "default" : "outline"}
            size="sm"
            className="flex-1 h-7 text-xs px-1"
            onClick={() => setSelectedQty(qty)}
          >
            {qty}
          </Button>
        ))}
      </div>

      {/* YES Side */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-yes">SIM</span>
          {hasLowLiquidityYes && (
            <span className="flex items-center gap-1 text-warning text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              Baixa liquidez
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 rounded bg-yes-muted/30 border border-yes/10">
            <p className="text-muted-foreground mb-0.5">Compra</p>
            <p className="font-mono font-medium text-yes">
              {yesQuotes.buy ? `R$${(yesQuotes.buy.avgPrice / 100).toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="text-center p-2 rounded bg-muted border border-border">
            <p className="text-muted-foreground mb-0.5">Venda</p>
            <p className="font-mono font-medium">
              {yesQuotes.sell ? `R$${(yesQuotes.sell.avgPrice / 100).toFixed(2)}` : '—'}
            </p>
          </div>
        </div>
        {yesSpread && (
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <TrendingDown className="h-3 w-3" />
            <span>Spread: <span className="font-mono font-medium text-foreground">{yesSpread}%</span></span>
          </div>
        )}
      </div>

      {/* NO Side */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="font-medium text-no">NÃO</span>
          {hasLowLiquidityNo && (
            <span className="flex items-center gap-1 text-warning text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              Baixa liquidez
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 rounded bg-no-muted/30 border border-no/10">
            <p className="text-muted-foreground mb-0.5">Compra</p>
            <p className="font-mono font-medium text-no">
              {noQuotes.buy ? `R$${(noQuotes.buy.avgPrice / 100).toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="text-center p-2 rounded bg-muted border border-border">
            <p className="text-muted-foreground mb-0.5">Venda</p>
            <p className="font-mono font-medium">
              {noQuotes.sell ? `R$${(noQuotes.sell.avgPrice / 100).toFixed(2)}` : '—'}
            </p>
          </div>
        </div>
        {noSpread && (
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <TrendingDown className="h-3 w-3" />
            <span>Spread: <span className="font-mono font-medium text-foreground">{noSpread}%</span></span>
          </div>
        )}
      </div>

      {/* Liquidity Info */}
      {(yesShares !== undefined || noShares !== undefined) && (
        <div className="pt-2 border-t border-border text-[10px] text-muted-foreground text-center">
          Liquidez: SIM {yesShares?.toLocaleString() ?? '—'} | NÃO {noShares?.toLocaleString() ?? '—'} contratos
        </div>
      )}
    </div>
  );
}
