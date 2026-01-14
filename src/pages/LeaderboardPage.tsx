import { useState } from 'react';
import { Trophy, Settings, Award, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { LeaderboardProfileSettings } from '@/components/leaderboard/LeaderboardProfileSettings';
import { AchievementsBadges } from '@/components/leaderboard/AchievementsBadges';
import { MyStatsCard } from '@/components/leaderboard/MyStatsCard';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import type { LeaderboardSortBy } from '@/types/leaderboard';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('profit');
  const { data: entries, isLoading } = useLeaderboard(sortBy, 50);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
        </div>
        <p className="text-muted-foreground">
          Ranking dos melhores traders da plataforma. Participe e mostre suas habilidades!
        </p>
      </div>

      <Tabs defaultValue="ranking" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="ranking" className="gap-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Ranking</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Conquistas</span>
          </TabsTrigger>
          {user && (
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="space-y-6">
          {user && <MyStatsCard />}
          
          <LeaderboardTable
            entries={entries || []}
            isLoading={isLoading}
            sortBy={sortBy}
            onSortChange={setSortBy}
            currentUserId={user?.id}
          />
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements">
          <AchievementsBadges />
        </TabsContent>

        {/* Settings Tab */}
        {user && (
          <TabsContent value="settings" className="space-y-6">
            <LeaderboardProfileSettings />
            <MyStatsCard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
