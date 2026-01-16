import { Lock, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Achievement, UserAchievement } from '@/types/leaderboard';
import type { UserStats, AchievementProgress } from '@/lib/achievementProgress';
import { getAchievementProgress, formatProgressValue } from '@/lib/achievementProgress';

interface AchievementCardProps {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  stats: UserStats | null;
  isCompact?: boolean;
}

export function AchievementCard({ 
  achievement, 
  userAchievement,
  stats,
  isCompact = false
}: AchievementCardProps) {
  const isEarned = !!userAchievement;
  const progress = getAchievementProgress(achievement.code, stats);
  
  if (isCompact) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center",
          "h-14 w-14 rounded-full border-2 text-2xl",
          "transition-all duration-200",
          isEarned 
            ? "bg-primary/10 border-primary shadow-lg shadow-primary/20 hover:scale-110" 
            : "bg-muted/30 border-muted-foreground/20 opacity-50 grayscale"
        )}
        title={`${achievement.name}: ${achievement.description}`}
      >
        <span>{achievement.icon}</span>
        {!isEarned && (
          <Lock className="absolute -bottom-1 -right-1 h-4 w-4 text-muted-foreground bg-background rounded-full p-0.5" />
        )}
        {isEarned && (
          <Check className="absolute -bottom-1 -right-1 h-4 w-4 text-green-500 bg-background rounded-full p-0.5" />
        )}
      </div>
    );
  }

  return (
    <Card className={cn(
      "transition-all duration-200",
      isEarned 
        ? "bg-primary/5 border-primary/30 shadow-md" 
        : "bg-muted/20 border-muted"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            "flex items-center justify-center",
            "h-12 w-12 rounded-xl text-2xl shrink-0",
            isEarned 
              ? "bg-primary/10" 
              : "bg-muted/50 grayscale opacity-60"
          )}>
            {achievement.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={cn(
                "font-semibold truncate",
                !isEarned && "text-muted-foreground"
              )}>
                {achievement.name}
              </h4>
              <Badge 
                variant={isEarned ? "default" : "outline"} 
                className="shrink-0 text-xs"
              >
                {achievement.points} pts
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              {achievement.description}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isEarned ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  Conquistado
                </span>
              ) : (
                "Progresso"
              )}
            </span>
            <span className={cn(
              "font-medium",
              isEarned ? "text-green-600 dark:text-green-400" : "text-foreground"
            )}>
              {progress.percent}%
            </span>
          </div>
          
          <Progress 
            value={progress.percent} 
            className={cn(
              "h-2",
              isEarned && "[&>div]:bg-green-500"
            )}
          />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatProgressValue(progress.current, progress.metricLabel)} / {formatProgressValue(progress.target, progress.metricLabel)} {progress.metricLabel}
            </span>
            {isEarned && userAchievement && (
              <span className="text-green-600 dark:text-green-400">
                {new Date(userAchievement.earned_at).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
