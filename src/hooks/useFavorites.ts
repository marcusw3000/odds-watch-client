import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCallback } from 'react';

export interface Favorite {
  id: string;
  market_id: string;
  created_at: string;
}

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async (): Promise<Favorite[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_favorites')
        .select('id, market_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching favorites:', error);
        return [];
      }

      return (data || []) as Favorite[];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const addFavorite = useMutation({
    mutationFn: async (marketId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from('user_favorites')
        .insert({ user_id: user.id, market_id: marketId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (marketId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', user?.id] });
      
      const previousFavorites = queryClient.getQueryData<Favorite[]>(['favorites', user?.id]);
      
      // Optimistic update
      queryClient.setQueryData<Favorite[]>(['favorites', user?.id], (old = []) => [
        { id: 'temp', market_id: marketId, created_at: new Date().toISOString() },
        ...old,
      ]);

      return { previousFavorites };
    },
    onError: (err, marketId, context) => {
      queryClient.setQueryData(['favorites', user?.id], context?.previousFavorites);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (marketId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('market_id', marketId);

      if (error) throw error;
    },
    onMutate: async (marketId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', user?.id] });
      
      const previousFavorites = queryClient.getQueryData<Favorite[]>(['favorites', user?.id]);
      
      // Optimistic update
      queryClient.setQueryData<Favorite[]>(['favorites', user?.id], (old = []) =>
        old.filter((f) => f.market_id !== marketId)
      );

      return { previousFavorites };
    },
    onError: (err, marketId, context) => {
      queryClient.setQueryData(['favorites', user?.id], context?.previousFavorites);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  const isFavorite = useCallback(
    (marketId: string) => favorites.some((f) => f.market_id === marketId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (marketId: string) => {
      if (isFavorite(marketId)) {
        removeFavorite.mutate(marketId);
      } else {
        addFavorite.mutate(marketId);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  const favoriteIds = favorites.map((f) => f.market_id);

  return {
    favorites,
    favoriteIds,
    isLoading,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    isAddingFavorite: addFavorite.isPending,
    isRemovingFavorite: removeFavorite.isPending,
  };
}
