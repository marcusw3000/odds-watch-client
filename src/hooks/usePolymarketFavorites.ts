import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PolymarketFavorite { market_id: string; }
const queryKey = (userId?: string) => ["polymarket-favorites", userId] as const;

export function usePolymarketFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: favorites = [], isLoading } = useQuery({
    queryKey: queryKey(user?.id),
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async (): Promise<PolymarketFavorite[]> => {
      if (!user) return [];
      const { data, error } = await supabase.from("polymarket_favorites").select("market_id")
        .eq("user_id", user.id).eq("source", "polymarket");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async (marketId: string) => {
      if (!user) throw new Error("Authentication required");
      const { error } = await supabase.from("polymarket_favorites")
        .insert({ user_id: user.id, source: "polymarket", market_id: marketId });
      if (error && error.code !== "23505") throw error;
    },
    onMutate: async (marketId) => {
      await queryClient.cancelQueries({ queryKey: queryKey(user?.id) });
      const previous = queryClient.getQueryData<PolymarketFavorite[]>(queryKey(user?.id));
      queryClient.setQueryData<PolymarketFavorite[]>(queryKey(user?.id), (current = []) => [
        ...current.filter((favorite) => favorite.market_id !== marketId), { market_id: marketId },
      ]);
      return { previous };
    },
    onError: (_error, _marketId, context) => {
      queryClient.setQueryData(queryKey(user?.id), context?.previous ?? []);
      toast.error("Não foi possível salvar nos favoritos. Tente novamente.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey(user?.id) }),
  });

  const remove = useMutation({
    mutationFn: async (marketId: string) => {
      if (!user) throw new Error("Authentication required");
      const { error } = await supabase.from("polymarket_favorites").delete()
        .eq("user_id", user.id).eq("source", "polymarket").eq("market_id", marketId);
      if (error) throw error;
    },
    onMutate: async (marketId) => {
      await queryClient.cancelQueries({ queryKey: queryKey(user?.id) });
      const previous = queryClient.getQueryData<PolymarketFavorite[]>(queryKey(user?.id));
      queryClient.setQueryData<PolymarketFavorite[]>(queryKey(user?.id), (current = []) =>
        current.filter((favorite) => favorite.market_id !== marketId));
      return { previous };
    },
    onError: (_error, _marketId, context) => {
      queryClient.setQueryData(queryKey(user?.id), context?.previous ?? []);
      toast.error("Não foi possível remover dos favoritos. Tente novamente.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey(user?.id) }),
  });

  const isFavorite = useCallback((marketId: string) => favorites.some((favorite) => favorite.market_id === marketId), [favorites]);
  const toggleFavorite = useCallback((marketId: string) => {
    if (isFavorite(marketId)) remove.mutate(marketId); else add.mutate(marketId);
  }, [add, isFavorite, remove]);
  return { favorites, isFavorite, toggleFavorite, isLoading, isMutating: add.isPending || remove.isPending };
}
