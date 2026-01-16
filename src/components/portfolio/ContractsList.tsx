import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, Clock, CheckCircle, XCircle, ArrowRightLeft, Share2 } from 'lucide-react';
import { UserContract } from '@/types/market';
import { Button } from '@/components/ui/button';
import { SellModal } from '@/components/market/SellModal';
import { SharePositionCard } from '@/components/social/SharePositionCard';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { useToast } from '@/hooks/use-toast';
import { triggerPortfolioRefresh } from '@/hooks/usePortfolioRefresh';
import { cn } from '@/lib/utils';

interface ContractsListProps {
  contracts: UserContract[];
  type: 'active' | 'settled';
  onContractSold?: () => void;
}

export function ContractsList({ contracts, type, onContractSold }: ContractsListProps) {
  const [sellingContract, setSellingContract] = useState<UserContract | null>(null);
  const [currentMarketPrice, setCurrentMarketPrice] = useState(0);
  const { toast } = useToast();

  const filteredContracts = contracts.filter((c) =>
    type === 'active' ? c.status === 'ACTIVE' : c.status !== 'ACTIVE'
  );

  const handleOpenSellModal = async (contract: UserContract) => {
    const price = await MarketDataProvider.getCurrentPriceForContract(contract);
    setCurrentMarketPrice(price);
    setSellingContract(contract);
  };

  const handleRefreshPrice = async () => {
    if (!sellingContract) return 0;
    const price = await MarketDataProvider.getCurrentPriceForContract(sellingContract);
    setCurrentMarketPrice(price);
    return price;
  };

  const handleConfirmSell = async (lockedPrice: number) => {
    if (!sellingContract) return;

    const result = await MarketDataProvider.sellContract(sellingContract.id, lockedPrice);

    if (result.success) {
      toast({
        title: 'Contrato vendido!',
        description: `Você recebeu R$${result.saleValue?.toFixed(2)}.`,
      });
      setSellingContract(null);
      onContractSold?.();
      // Trigger portfolio refresh for other components
      triggerPortfolioRefresh();
    } else {
      throw new Error(result.message);
    }
  };

  if (filteredContracts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>
          {type === 'active'
            ? 'Você não possui contratos ativos.'
            : 'Nenhum contrato finalizado.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {filteredContracts.map((contract) => {
          const isYes = contract.outcome === 'YES';
          const purchasePrice = (contract.priceAtPurchase / 100) * contract.quantity;
          const potentialPayout = contract.quantity;
          const potentialProfit = potentialPayout - purchasePrice;

          return (
            <div
              key={contract.id}
              className="p-4 rounded-xl border border-border bg-card hover:bg-card-hover transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-bold",
                        isYes ? "bg-yes-muted text-yes" : "bg-no-muted text-no"
                      )}
                    >
                      {contract.outcome}
                    </span>
                    {contract.status === 'ACTIVE' ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Ativo
                      </span>
                    ) : contract.status === 'WON' ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle className="h-3 w-3" />
                        Venceu
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <XCircle className="h-3 w-3" />
                        Perdeu
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium text-sm leading-snug truncate">
                    {contract.eventTitle}
                  </h4>

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>
                      Comprado em:{' '}
                      {format(contract.purchasedAt, "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <span>Qtd: {contract.quantity}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {contract.status === 'ACTIVE' ? 'Lucro potencial' : 'Resultado'}
                    </p>
                    {contract.status === 'ACTIVE' ? (
                      <p className="font-mono font-bold text-success">
                        +R${potentialProfit.toFixed(2)}
                      </p>
                    ) : contract.status === 'WON' ? (
                      <p className="font-mono font-bold text-success">
                        +R${(contract.payout || potentialPayout).toFixed(2)}
                      </p>
                    ) : (
                      <p className="font-mono font-bold text-destructive">
                        -R${purchasePrice.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Investido: R${purchasePrice.toFixed(2)}
                    </p>
                  </div>

                  {contract.status === 'ACTIVE' && (
                    <div className="flex gap-2 mt-2">
                      <SharePositionCard
                        position={{
                          eventTitle: contract.eventTitle,
                          outcome: contract.outcome,
                          quantity: contract.quantity,
                          priceAtPurchase: contract.priceAtPurchase,
                          currentPrice: contract.priceAtPurchase, // Simplified
                          profitPercent: ((potentialPayout - purchasePrice) / purchasePrice) * 100,
                        }}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Share2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenSellModal(contract)}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                        Vender
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sell Modal */}
      {sellingContract && (
        <SellModal
          contract={sellingContract}
          currentMarketPrice={currentMarketPrice}
          onClose={() => setSellingContract(null)}
          onConfirm={handleConfirmSell}
          onRefreshPrice={handleRefreshPrice}
        />
      )}
    </>
  );
}
