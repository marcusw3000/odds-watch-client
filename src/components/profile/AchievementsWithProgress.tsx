import { useState } from 'react';
import { Award, Grid3X3, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAchievements, useMyAchievements } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { AchievementCard } from './AchievementCard';
import type { ExtendedUserStats } from '@/lib/achievementProgress';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

type FilterType = 'all' | 'earned' | 'in_progress';
type ViewMode = 'cards' | 'compact';

const categories: Record<string, string> = {
  trading: 'Trading',
  profit: 'Lucro',
  streak: 'Sequência',
  volume: 'Volume',
  leaderboard: 'Ranking',
  special: 'Especial',
  referral: 'Indicação',
};

export function AchievementsWithProgress() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  
  const { data: allAchievements, isLoading: loadingAll } = useAchievements();
  const { data: myAchievements, isLoading: loadingMine } = useMyAchievements();
  
  // Fetch user stats for progress calculation (including new achievement fields)
  const { data: stats } = useQuery({
    queryKey: ['my-profile-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select(`
          total_trades, total_profit, total_volume, winning_trades, 
          best_streak, current_streak, roi_percent, best_trade_profit,
          markets_won_streak, best_markets_won_streak, has_night_trade,
          has_early_trade, weekend_trades, has_speed_trade, has_contrarian_trade,
          total_referrals, activated_referrals, total_referral_commission
        `)
        .eq('id', user.id)
        .single();
      return data as ExtendedUserStats | null;
    },
    enabled: !!user,
  });

  const isLoading = loadingAll || loadingMine;

  const earnedIds = new Set(myAchievements?.map(a => a.achievement_id) || []);
  
  // Filter achievements based on selected filter
  const filteredAchievements = allAchievements?.filter(achievement => {
    const isEarned = earnedIds.has(achievement.id);
    if (filter === 'earned') return isEarned;
    if (filter === 'in_progress') return !isEarned;
    return true;
  });

  // Group by category
  const groupedAchievements = filteredAchievements?.reduce((acc, achievement) => {
    const category = achievement.category as keyof typeof categories;
    if (!acc[category]) acc[category] = [];
    acc[category].push(achievement);
    return acc;
  }, {} as Record<string, typeof filteredAchievements>);

  // Calculate totals
  const totalEarned = myAchievements?.length || 0;
  const totalAchievements = allAchievements?.length || 0;
  const totalPoints = myAchievements?.reduce((sum, ua) => {
    const achievement = allAchievements?.find(a => a.id === ua.achievement_id);
    return sum + (achievement?.points || 0);
  }, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Conquistas
            </CardTitle>
            <CardDescription>
              {user 
                ? `${totalEarned} de ${totalAchievements} conquistas desbloqueadas`
                : 'Faça login para ver suas conquistas'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {totalPoints} pts
              </Badge>
            )}
            <div className="flex border rounded-lg p-0.5">
              <Button 
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'} 
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === 'compact' ? 'secondary' : 'ghost'} 
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('compact')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              Todas ({totalAchievements})
            </TabsTrigger>
            <TabsTrigger value="earned">
              Conquistadas ({totalEarned})
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              Em Progresso ({totalAchievements - totalEarned})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="space-y-6">
        {Object.entries(groupedAchievements || {}).map(([category, achievements]) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              {categories[category] || category}
            </h4>
            
            {viewMode === 'cards' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {achievements?.map((achievement) => {
                  const userAchievement = myAchievements?.find(
                    a => a.achievement_id === achievement.id
                  );
                  return (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      userAchievement={userAchievement}
                      stats={stats}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {achievements?.map((achievement) => {
                  const userAchievement = myAchievements?.find(
                    a => a.achievement_id === achievement.id
                  );
                  return (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      userAchievement={userAchievement}
                      stats={stats}
                      isCompact
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {(!groupedAchievements || Object.keys(groupedAchievements).length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            {filter === 'earned' 
              ? 'Nenhuma conquista desbloqueada ainda. Continue negociando!'
              : filter === 'in_progress'
              ? 'Todas as conquistas já foram desbloqueadas! 🎉'
              : 'Nenhuma conquista disponível.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
