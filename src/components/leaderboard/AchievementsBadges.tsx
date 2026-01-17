import { Award, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAchievements, useMyAchievements } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export function AchievementsBadges() {
  const { user } = useAuth();
  const { data: allAchievements, isLoading: loadingAll } = useAchievements();
  const { data: myAchievements, isLoading: loadingMine } = useMyAchievements();

  const isLoading = loadingAll || loadingMine;

  const earnedIds = new Set(myAchievements?.map(a => a.achievement_id) || []);

  const categories = {
    trading: 'Trading',
    profit: 'Lucro',
    streak: 'Sequência',
    volume: 'Volume',
    leaderboard: 'Ranking',
    special: 'Especial',
    referral: 'Indicação',
  };

  const groupedAchievements = allAchievements?.reduce((acc, achievement) => {
    const category = achievement.category as keyof typeof categories;
    if (!acc[category]) acc[category] = [];
    acc[category].push(achievement);
    return acc;
  }, {} as Record<string, typeof allAchievements>);

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
          <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPoints = myAchievements?.reduce((sum, ua) => {
    const achievement = allAchievements?.find(a => a.id === ua.achievement_id);
    return sum + (achievement?.points || 0);
  }, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Conquistas
            </CardTitle>
            <CardDescription>
              {user 
                ? `${myAchievements?.length || 0} de ${allAchievements?.length || 0} conquistas desbloqueadas`
                : 'Faça login para ver suas conquistas'}
            </CardDescription>
          </div>
          {user && (
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {totalPoints} pts
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groupedAchievements || {}).map(([category, achievements]) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              {categories[category as keyof typeof categories] || category}
            </h4>
            <div className="flex flex-wrap gap-3">
              {achievements?.map((achievement) => {
                const isEarned = earnedIds.has(achievement.id);
                const earnedAchievement = myAchievements?.find(
                  a => a.achievement_id === achievement.id
                );

                return (
                  <Tooltip key={achievement.id}>
                    <TooltipTrigger asChild>
                      <div
                        className={`
                          relative flex items-center justify-center
                          h-14 w-14 rounded-full border-2 text-2xl
                          transition-all duration-200
                          ${isEarned 
                            ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20 cursor-pointer hover:scale-110' 
                            : 'bg-muted/30 border-muted-foreground/20 opacity-50 grayscale'
                          }
                        `}
                      >
                        <span>{achievement.icon}</span>
                        {!isEarned && (
                          <Lock className="absolute -bottom-1 -right-1 h-4 w-4 text-muted-foreground bg-background rounded-full p-0.5" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold">{achievement.name}</p>
                        <p className="text-xs text-muted-foreground">{achievement.description}</p>
                        <div className="flex items-center justify-between pt-1">
                          <Badge variant="outline" className="text-xs">
                            {achievement.points} pts
                          </Badge>
                          {isEarned && earnedAchievement && (
                            <span className="text-xs text-green-500">
                              ✓ {new Date(earnedAchievement.earned_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
