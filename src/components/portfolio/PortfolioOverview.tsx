import { Wallet, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { UserPortfolio } from '@/types/market';
import { cn } from '@/lib/utils';
import { useDisplayCurrency } from '@/contexts/CurrencyContext';

interface PortfolioOverviewProps {
  portfolio: UserPortfolio;
}

export function PortfolioOverview({ portfolio }: PortfolioOverviewProps) {
  const { formatUsdFromBrl } = useDisplayCurrency();
  // formatCurrency is now imported from @/lib/formatters

  const activeContracts = portfolio.contracts.filter(c => c.status === 'ACTIVE');
  const settledContracts = portfolio.contracts.filter(c => c.status !== 'ACTIVE');
  const totalInvested = activeContracts.reduce(
    (sum, c) => sum + (c.priceAtPurchase / 100) * c.quantity,
    0
  );

  const stats = [
    {
      label: 'Saldo Disponível',
      value: formatUsdFromBrl(portfolio.balance),
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Total Investido',
      value: formatUsdFromBrl(totalInvested),
      icon: BarChart3,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Lucro/Prejuízo',
      value: formatUsdFromBrl(portfolio.totalProfit),
      icon: portfolio.totalProfit >= 0 ? TrendingUp : TrendingDown,
      color: portfolio.totalProfit >= 0 ? 'text-success' : 'text-destructive',
      bgColor: portfolio.totalProfit >= 0 ? 'bg-success/10' : 'bg-destructive/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-xl border border-border bg-card shadow-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className={cn("text-2xl font-bold font-mono", stat.color)}>
                  {stat.value}
                </p>
              </div>
              <div className={cn("p-3 rounded-lg", stat.bgColor)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span>{activeContracts.length} contratos ativos</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span>{settledContracts.length} finalizados</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>{portfolio.transactions.length} transações</span>
        </div>
      </div>
    </div>
  );
}
