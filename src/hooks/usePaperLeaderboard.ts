import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { LeaderboardEntry, LeaderboardSortBy } from "@/types/leaderboard";

export interface PaperRankingStats { total_profit: number; roi_percent: number; total_volume: number; total_trades: number; winning_trades: number }

function mapEntry(row: Record<string, unknown>): LeaderboardEntry {
  return { rank: Number(row.rank), user_id: String(row.user_id), display_name: String(row.display_name), avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    total_profit: Number(row.total_profit ?? 0), roi_percent: Number(row.roi_percent ?? 0), total_volume: Number(row.total_volume ?? 0), total_trades: Number(row.total_trades ?? 0), winning_trades: Number(row.winning_trades ?? 0),
    show_profit: row.show_profit === true, show_roi: row.show_roi === true, show_volume: row.show_volume === true, show_trades: row.show_trades === true };
}

export function usePaperLeaderboardPages(sortBy: LeaderboardSortBy, limit = 50) {
  return useInfiniteQuery({ queryKey: ["paper-leaderboard", "pages", sortBy, limit], initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<{ entries: LeaderboardEntry[]; paginated: boolean }> => {
      const { data, error } = await (supabase as any).rpc("get_paper_leaderboard_page", { p_sort: sortBy, p_limit: limit, p_offset: pageParam });
      if (error?.code === "PGRST202" && pageParam === 0) {
        const legacy = await (supabase as any).rpc("get_paper_leaderboard", { p_sort: sortBy, p_limit: 100 });
        if (legacy.error) throw legacy.error;
        return { entries: (legacy.data ?? []).map(mapEntry), paginated: false };
      }
      if (error) throw error;
      return { entries: (data ?? []).map(mapEntry), paginated: true };
    },
    getNextPageParam: (lastPage, pages) => lastPage.paginated && lastPage.entries.length === limit ? pages.length * limit : undefined,
  });
}

export function usePaperLeaderboard(sortBy: LeaderboardSortBy, limit = 50) {
  return useQuery({ queryKey: ["paper-leaderboard", sortBy, limit], queryFn: async (): Promise<LeaderboardEntry[]> => {
    const { data, error } = await (supabase as any).rpc("get_paper_leaderboard", { p_sort: sortBy, p_limit: limit });
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      rank: Number(row.rank), user_id: String(row.user_id), display_name: String(row.display_name), avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
      total_profit: Number(row.total_profit ?? 0), roi_percent: Number(row.roi_percent ?? 0), total_volume: Number(row.total_volume ?? 0),
      total_trades: Number(row.total_trades ?? 0), winning_trades: Number(row.winning_trades ?? 0),
      show_profit: row.show_profit === true, show_roi: row.show_roi === true, show_volume: row.show_volume === true, show_trades: row.show_trades === true,
    }));
  } });
}

export function useMyPaperRanking() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["my-paper-ranking", user?.id], enabled: Boolean(user), queryFn: async (): Promise<PaperRankingStats> => {
    const { data, error } = await (supabase as any).rpc("get_my_paper_ranking_stats");
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error("Estatísticas do simulador indisponíveis.");
    return { total_profit: Number(row.total_profit), roi_percent: Number(row.roi_percent), total_volume: Number(row.total_volume), total_trades: Number(row.total_trades), winning_trades: Number(row.winning_trades) };
  } });
}
