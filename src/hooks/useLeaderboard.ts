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
import type { Tables } from '@/integrations/supabase/types';

// Type for profile data from database (with type cast for migration period)
interface ProfileData {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_public: boolean;
  show_profit: boolean;
  show_roi: boolean;
  show_volume: boolean;
  show_trades: boolean;
  total_profit: number;
  roi_percent: number;
  total_volume: number;
  total_trades: number;
  winning_trades: number;
  current_streak: number;
  best_streak: number;
  best_trade_profit: number;
}

export function useLeaderboard(sortBy: LeaderboardSortBy = 'profit', limit: number = 50) {
  return useQuery({
    queryKey: ['leaderboard', sortBy, limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      // Fetch public profiles using the secure profiles_public view (excludes PII like email/full_name)
      const result = await supabase
        .from('profiles_public')
        .select('id, display_name, is_public, show_profit, show_roi, show_volume, show_trades, total_profit, roi_percent, total_volume, total_trades, winning_trades');
      
      const profiles = (result.data || []) as ProfileData[];
      const error = result.error;

      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      // Filter out profiles without display_name and map to leaderboard entries
      const entries: LeaderboardEntry[] = profiles
        .filter((profile) => profile.display_name && profile.display_name.trim() !== '')
        .map((profile) => ({
        rank: 0,
        user_id: profile.id,
        display_name: profile.display_name!,
        total_profit: profile.total_profit || 0,
        roi_percent: profile.roi_percent || 0,
        total_volume: profile.total_volume || 0,
        total_trades: profile.total_trades || 0,
        winning_trades: profile.winning_trades || 0,
        show_profit: profile.show_profit,
        show_roi: profile.show_roi,
        show_volume: profile.show_volume,
        show_trades: profile.show_trades,
      }));

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
        .from('profiles')
        .select('id, display_name, bio, avatar_url, is_public, show_profit, show_roi, show_volume, show_trades, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle() as { data: ProfileData | null; error: unknown };

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        user_id: data.id,
        display_name: data.display_name || 'Trader Anônimo',
        bio: data.bio,
        avatar_url: data.avatar_url,
        is_public: data.is_public,
        show_profit: data.show_profit,
        show_roi: data.show_roi,
        show_volume: data.show_volume,
        show_trades: data.show_trades,
        created_at: '',
        updated_at: '',
      };
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
        .from('profiles')
        .select('id, total_profit, roi_percent, total_volume, total_trades, winning_trades, current_streak, best_streak, best_trade_profit, updated_at')
        .eq('id', user.id)
        .maybeSingle() as { data: ProfileData | null; error: unknown };

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        user_id: data.id,
        total_profit: data.total_profit || 0,
        roi_percent: data.roi_percent || 0,
        total_volume: data.total_volume || 0,
        total_trades: data.total_trades || 0,
        winning_trades: data.winning_trades || 0,
        current_streak: data.current_streak || 0,
        best_streak: data.best_streak || 0,
        best_trade_profit: data.best_trade_profit || 0,
        updated_at: '',
      };
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

      // Update profile with leaderboard fields (using type assertion for migration period)
      const updatePayload = {
        display_name: updates.display_name,
        bio: updates.bio,
        is_public: updates.is_public,
        show_profit: updates.show_profit,
        show_roi: updates.show_roi,
        show_volume: updates.show_volume,
        show_trades: updates.show_trades,
      };
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      // No longer needed - stats are part of profiles table which is auto-created
      // This is a no-op for backward compatibility
    },
  });
}

// Hook for viewing another user's public profile
export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async (): Promise<Tables<'profiles_public'> | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// Hook for updating avatar
export function useUpdateAvatar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leaderboard-profile'] });
      queryClient.invalidateQueries({ queryKey: ['public-profile'] });
    },
  });
}
