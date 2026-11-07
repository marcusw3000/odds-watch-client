import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Award, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { PaperProfileAchievements } from '@/components/profile/PaperProfileSections';
import { usePaperProfile } from '@/hooks/usePaperProfile';
import { MyStatsCard } from '@/components/leaderboard/MyStatsCard';
import { usePaperLeaderboard } from '@/hooks/usePaperLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import type { LeaderboardSortBy } from '@/types/leaderboard';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('profit');
  const { data: entries, isLoading, isError } = usePaperLeaderboard(sortBy, 50);
  const paperProfile = usePaperProfile(user?.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Leaderboard</h1>
          </div>
          {user && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Configurar Perfil</span>
              </Link>
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          Ranking do Paper Trading Polymarket em USD virtual. A classificação usa apenas resultados realizados em operações verificadas.
        </p>
      </div>

      <Tabs defaultValue="ranking" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="ranking" className="gap-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Ranking</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Conquistas</span>
          </TabsTrigger>
        </TabsList>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="space-y-6">
          {user && <MyStatsCard />}
          
          {isError ? <p role="alert" className="text-destructive">Não foi possível carregar o ranking simulado.</p> : <LeaderboardTable
            entries={entries || []}
            isLoading={isLoading}
            sortBy={sortBy}
            onSortChange={setSortBy}
            currentUserId={user?.id}
          />}
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements">
          {!user ? <p>Entre para acompanhar suas conquistas no simulador.</p> : paperProfile.isLoading ? <p>Carregando conquistas...</p> : paperProfile.isError || !paperProfile.data ? <p role="alert">Não foi possível carregar as conquistas. <button className="underline" onClick={() => paperProfile.refetch()}>Tentar novamente</button></p> : <PaperProfileAchievements data={paperProfile.data} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
