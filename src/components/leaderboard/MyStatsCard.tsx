import { TrendingUp, BarChart3, Activity, Trophy, Flame, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyStatistics, useMyLeaderboardProfile } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyWithSign } from '@/lib/formatters';

export function MyStatsCard() {
  const { user } = useAuth();
  const { data: stats, isLoading: loadingStats } = useMyStatistics();
  const { data: profile } = useMyLeaderboardProfile();

  if (!user) {
    return null;
  }

  if (loadingStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Suas Estatísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Using formatCurrencyWithSign from @/lib/formatters
  const formatCurrency = (value: number) => formatCurrencyWithSign(value);

  const winRate = stats?.total_trades 
    ? ((stats.winning_trades / stats.total_trades) * 100).toFixed(2) 
    : '0.00';

  const statItems = [
    {
      icon: TrendingUp,
      label: 'Lucro Total',
      value: formatCurrency(stats?.total_profit || 0),
      color: (stats?.total_profit || 0) >= 0 ? 'text-green-500' : 'text-red-500',
    },
    {
      icon: BarChart3,
      label: 'ROI',
      value: `${(stats?.roi_percent || 0) >= 0 ? '+' : ''}${(stats?.roi_percent || 0).toFixed(2)}%`,
      color: (stats?.roi_percent || 0) >= 0 ? 'text-green-500' : 'text-red-500',
    },
    {
      icon: Activity,
      label: 'Volume Total',
      value: `R$${(Math.round((stats?.total_volume || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      color: 'text-foreground',
    },
    {
      icon: Trophy,
      label: 'Total de Trades',
      value: `${stats?.total_trades || 0}`,
      color: 'text-foreground',
    },
    {
      icon: Target,
      label: 'Win Rate',
      value: `${winRate}%`,
      color: Number(winRate) >= 50 ? 'text-green-500' : 'text-orange-500',
    },
    {
      icon: Flame,
      label: 'Melhor Sequência',
      value: `${stats?.best_streak || 0} wins`,
      color: 'text-orange-500',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Suas Estatísticas
        </CardTitle>
        <CardDescription>
          {profile?.is_public 
            ? 'Estas estatísticas estão visíveis no leaderboard público'
            : 'Estas estatísticas são privadas'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statItems.map((item) => (
            <div 
              key={item.label}
              className="p-4 rounded-lg bg-muted/30 border border-border"
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <item.icon className="h-4 w-4" />
                <span className="text-xs">{item.label}</span>
              </div>
              <p className={`text-xl font-bold font-mono ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
