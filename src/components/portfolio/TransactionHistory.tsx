import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Gift } from 'lucide-react';
import { Transaction } from '@/types/market';
import { cn } from '@/lib/utils';

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'DEPOSIT':
        return Wallet;
      case 'BUY':
        return ArrowDownCircle;
      case 'SELL':
        return ArrowUpCircle;
      case 'PAYOUT':
        return Gift;
      default:
        return Wallet;
    }
  };

  const getTransactionLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'DEPOSIT':
        return 'Depósito';
      case 'BUY':
        return 'Compra';
      case 'SELL':
        return 'Venda';
      case 'PAYOUT':
        return 'Pagamento';
      default:
        return type;
    }
  };

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (sortedTransactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma transação registrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedTransactions.map((tx) => {
        const Icon = getTransactionIcon(tx.type);
        const isPositive = tx.amount > 0;

        return (
          <div
            key={tx.id}
            className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-card-hover transition-colors"
          >
            <div
              className={cn(
                "p-2 rounded-lg",
                isPositive ? "bg-success/10" : "bg-muted"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isPositive ? "text-success" : "text-muted-foreground"
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {getTransactionLabel(tx.type)}
                </span>
                {tx.outcome && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-medium",
                      tx.outcome === 'YES'
                        ? "bg-yes-muted text-yes"
                        : "bg-no-muted text-no"
                    )}
                  >
                    {tx.outcome}
                  </span>
                )}
              </div>
              {tx.eventTitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {tx.eventTitle}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {format(tx.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>

            <div className="text-right">
              <p
                className={cn(
                  "font-mono font-bold",
                  isPositive ? "text-success" : "text-foreground"
                )}
              >
                {isPositive ? '+' : ''}R${Math.abs(tx.amount).toFixed(2)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
