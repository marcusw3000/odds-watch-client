import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { TradeQuote } from '@/services/LMSRCalculator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface BidAskSpreadProps {
  eventId: string;
  quantity?: number;
}

export function BidAskSpread({ eventId, quantity = 10 }: BidAskSpreadProps) {
  const [buyQuote, setBuyQuote] = useState<TradeQuote | null>(null);
  const [sellQuote, setSellQuote] = useState<TradeQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      setIsLoading(true);
      try {
        const [buy, sell] = await Promise.all([
          MarketDataProvider.getQuote(eventId, 'YES', quantity),
          MarketDataProvider.getSellQuote(eventId, 'YES', quantity),
        ]);
        setBuyQuote(buy);
        setSellQuote(sell);
      } catch (error) {
        console.error('Error fetching bid/ask quotes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuotes();
  }, [eventId, quantity]);

  if (isLoading) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    );
  }

  const buyPrice = buyQuote ? (buyQuote.avgPrice / 100) : null;
  const sellPrice = sellQuote ? (sellQuote.avgPrice / 100) : null;
  
  const spread = buyPrice && sellPrice 
    ? ((buyPrice - sellPrice) / buyPrice * 100).toFixed(1)
    : null;

  return (
    <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs space-y-2">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="font-medium">Spread ({quantity} contratos)</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[200px]">
            <p className="text-xs">
              Diferença entre preço de compra e venda para {quantity} contratos. 
              O spread existe porque grandes ordens impactam o preço de mercado.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center p-2 rounded bg-yes-muted/30 border border-yes/10">
          <p className="text-muted-foreground mb-0.5">Compra SIM</p>
          <p className="font-mono font-medium text-yes">
            {buyPrice ? `R$${buyPrice.toFixed(2)}/un` : '—'}
          </p>
        </div>
        <div className="text-center p-2 rounded bg-muted border border-border">
          <p className="text-muted-foreground mb-0.5">Venda SIM</p>
          <p className="font-mono font-medium">
            {sellPrice ? `R$${sellPrice.toFixed(2)}/un` : '—'}
          </p>
        </div>
      </div>
      {spread && (
        <p className="text-center text-muted-foreground">
          Spread: <span className="font-mono font-medium text-foreground">{spread}%</span>
        </p>
      )}
    </div>
  );
}
