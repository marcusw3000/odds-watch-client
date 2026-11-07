import { useState } from 'react';
import { Trophy, Award } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { PolymarketLeaderboard } from '@/components/leaderboard/PolymarketLeaderboard';
import { PaperProfileAchievements } from '@/components/profile/PaperProfileSections';
import { usePaperProfile } from '@/hooks/usePaperProfile';
import { MyStatsCard } from '@/components/leaderboard/MyStatsCard';
import { usePaperLeaderboardPages } from '@/hooks/usePaperLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import type { LeaderboardSortBy } from '@/types/leaderboard';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('profit');
  const ranking = usePaperLeaderboardPages(sortBy, 50);
  const entries = ranking.data?.pages.flatMap(page => page.entries) ?? [];
  const paperProfile = usePaperProfile(user?.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Tabs defaultValue="ranking" className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Leaderboard</h1>
          </div>
        <p className="text-muted-foreground">
          Acompanhe os traders da Polymarket e o ranking simulado da plataforma.
        </p>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="polymarket">Polymarket</TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2">
            <Trophy className="h-4 w-4" />
            <span>Paper Trading</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2">
            <Award className="h-4 w-4" />
            <span>Conquistas</span>
          </TabsTrigger>
        </TabsList>
          </div>
          {user && <MyStatsCard />}
        </div>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="space-y-6">
          
          <p className="text-sm text-muted-foreground">Ranking em USD virtual. O lucro considera vendas de posições verificadas; somente perfis públicos elegíveis aparecem.</p>
          <label className="sr-only" htmlFor="paper-ranking-order">Ordenar ranking simulado</label>
          <select id="paper-ranking-order" value={sortBy} onChange={event => setSortBy(event.target.value as LeaderboardSortBy)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="profit">Lucro/Prejuízo</option><option value="roi">ROI</option><option value="volume">Volume</option><option value="trades">Trades</option></select>
          {ranking.isError && !entries.length ? <p role="alert" className="text-destructive">Não foi possível carregar o ranking simulado. <button className="underline" onClick={() => ranking.refetch()}>Tentar novamente</button></p> : <LeaderboardTable entries={entries} isLoading={ranking.isLoading} currentUserId={user?.id} />}
          {ranking.isFetchNextPageError && <p role="alert" className="text-destructive">Não foi possível carregar mais participantes.</p>}
          {ranking.data?.pages[0]?.paginated === false && <p role="status" className="text-xs text-muted-foreground">Exibindo até 100 participantes. A paginação completa depende da atualização do banco.</p>}
          {ranking.hasNextPage && <div className="flex justify-center"><Button variant="outline" disabled={ranking.isFetchingNextPage} onClick={() => ranking.fetchNextPage()}>{ranking.isFetchingNextPage ? "Carregando..." : "Carregar mais"}</Button></div>}
        </TabsContent>

        <TabsContent value="polymarket"><PolymarketLeaderboard /></TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements">
          {!user ? <p>Entre para acompanhar suas conquistas no simulador.</p> : paperProfile.isLoading ? <p>Carregando conquistas...</p> : paperProfile.isError || !paperProfile.data ? <p role="alert">Não foi possível carregar as conquistas. <button className="underline" onClick={() => paperProfile.refetch()}>Tentar novamente</button></p> : <PaperProfileAchievements data={paperProfile.data} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
