import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { 
  LeaderboardProfile, 
  UserStatistics, 
  Achievement, 
  UserAchievement,
  LeaderboardEntry,
  LeaderboardSortBy 
} from '@/types/leaderboard';

export function useLeaderboard(sortBy: LeaderboardSortBy = 'profit', limit: number = 50) {
  return useQuery({
    queryKey: ['leaderboard', sortBy, limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      // Fetch public leaderboard profiles with stats
      const { data: profiles, error: profilesError } = await supabase
        .from('leaderboard_profiles')
        .select('*')
        .eq('is_public', true);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];

      const userIds = profiles.map(p => p.user_id);

      const { data: stats, error: statsError } = await supabase
        .from('user_statistics')
        .select('*')
        .in('user_id', userIds);

      if (statsError) throw statsError;

      // Combine and sort
      const entries: LeaderboardEntry[] = profiles.map((profile, index) => {
        const stat = stats?.find(s => s.user_id === profile.user_id);
        return {
          rank: 0,
          user_id: profile.user_id,
          display_name: profile.display_name,
          total_profit: stat?.total_profit || 0,
          roi_percent: stat?.roi_percent || 0,
          total_volume: stat?.total_volume || 0,
          total_trades: stat?.total_trades || 0,
          winning_trades: stat?.winning_trades || 0,
          show_profit: profile.show_profit,
          show_roi: profile.show_roi,
          show_volume: profile.show_volume,
          show_trades: profile.show_trades,
        };
      });

      // Sort by selected metric
      const sortFn = {
        profit: (a: LeaderboardEntry, b: LeaderboardEntry) => b.total_profit - a.total_profit,
        roi: (a: LeaderboardEntry, b: LeaderboardEntry) => b.roi_percent - a.roi_percent,
        volume: (a: LeaderboardEntry, b: LeaderboardEntry) => b.total_volume - a.total_volume,
        trades: (a: LeaderboardEntry, b: LeaderboardEntry) => b.total_trades - a.total_trades,
      };

      entries.sort(sortFn[sortBy]);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries.slice(0, limit);
    },
  });
}

export function useMyLeaderboardProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-leaderboard-profile', user?.id],
    queryFn: async (): Promise<LeaderboardProfile | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('leaderboard_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as LeaderboardProfile | null;
    },
    enabled: !!user,
  });
}

export function useMyStatistics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-statistics', user?.id],
    queryFn: async (): Promise<UserStatistics | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as UserStatistics | null;
    },
    enabled: !!user,
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: async (): Promise<Achievement[]> => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('points');

      if (error) throw error;
      return (data || []) as Achievement[];
    },
  });
}

export function useMyAchievements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-achievements', user?.id],
    queryFn: async (): Promise<UserAchievement[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as UserAchievement[];
    },
    enabled: !!user,
  });
}

export function useUpdateLeaderboardProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<LeaderboardProfile>) => {
      if (!user) throw new Error('Not authenticated');

      // Check if profile exists
      const { data: existing } = await supabase
        .from('leaderboard_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('leaderboard_profiles')
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('leaderboard_profiles')
          .insert({
            user_id: user.id,
            display_name: updates.display_name || 'Trader Anônimo',
            is_public: updates.is_public || false,
            show_profit: updates.show_profit ?? true,
            show_roi: updates.show_roi ?? true,
            show_volume: updates.show_volume ?? true,
            show_trades: updates.show_trades ?? true,
            bio: updates.bio || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaderboard-profile'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export function useInitializeUserStats() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Check if stats exist
      const { data: existing } = await supabase
        .from('user_statistics')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase
          .from('user_statistics')
          .insert({ user_id: user.id });

        if (error) throw error;
      }
    },
  });
}
