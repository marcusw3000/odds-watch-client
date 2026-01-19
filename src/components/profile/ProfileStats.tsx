import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity, 
  Target, 
  Flame,
  Trophy,
  EyeOff 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrencyWithSign, formatPercent } from '@/lib/formatters';
import type { UserProfile } from '@/types/leaderboard';

interface ProfileStatsProps {
  profile: UserProfile;
  isOwnProfile: boolean;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  hidden?: boolean;
}

function StatCard({ label, value, icon: Icon, trend, hidden }: StatCardProps) {
  if (hidden) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <EyeOff className="h-4 w-4" />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <p className="text-lg text-muted-foreground">Oculto</p>
        </CardContent>
      </Card>
    );
  }

  const trendColor = trend === 'up' 
    ? 'text-green-500' 
    : trend === 'down' 
      ? 'text-red-500' 
      : 'text-foreground';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <p className={`text-xl font-bold font-mono ${trendColor}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function ProfileStats({ profile, isOwnProfile }: ProfileStatsProps) {
  const canSeeProfit = isOwnProfile || profile.show_profit;
  const canSeeROI = isOwnProfile || profile.show_roi;
  const canSeeVolume = isOwnProfile || profile.show_volume;
  const canSeeTrades = isOwnProfile || profile.show_trades;

  const winRate = profile.total_trades > 0 
    ? ((profile.winning_trades / profile.total_trades) * 100).toFixed(1)
    : '0.0';

  const stats: StatCardProps[] = [
    {
      label: 'Lucro Total',
      value: formatCurrencyWithSign(profile.total_profit),
      icon: profile.total_profit >= 0 ? TrendingUp : TrendingDown,
      trend: profile.total_profit >= 0 ? 'up' : 'down',
      hidden: !canSeeProfit,
    },
    {
      label: 'ROI',
      value: formatPercent(profile.roi_percent),
      icon: BarChart3,
      trend: profile.roi_percent >= 0 ? 'up' : 'down',
      hidden: !canSeeROI,
    },
    {
      label: 'Volume Total',
      value: `R$${profile.total_volume.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: Activity,
      hidden: !canSeeVolume,
    },
    {
      label: 'Total de Trades',
      value: profile.total_trades,
      icon: Target,
      hidden: !canSeeTrades,
    },
    {
      label: 'Taxa de Acerto',
      value: `${winRate}%`,
      icon: Trophy,
      hidden: !canSeeTrades,
    },
    {
      label: 'Melhor Trade',
      value: formatCurrencyWithSign(profile.best_trade_profit),
      icon: TrendingUp,
      trend: profile.best_trade_profit >= 0 ? 'up' : 'neutral',
      hidden: !canSeeProfit,
    },
    {
      label: 'Streak Atual',
      value: `${profile.current_streak} vitórias`,
      icon: Flame,
      hidden: !canSeeTrades,
    },
    {
      label: 'Melhor Streak',
      value: `${profile.best_streak} vitórias`,
      icon: Flame,
      hidden: !canSeeTrades,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
