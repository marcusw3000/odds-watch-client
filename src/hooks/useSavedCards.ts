import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export function useSavedCards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['saved-cards', user?.id],
    queryFn: async (): Promise<SavedCard[]> => {
      if (!user) return [];

      const { data, error } = await supabase.functions.invoke('get-saved-cards');

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.cards || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useChargeSavedCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, paymentMethodId }: { amount: number; paymentMethodId: string }): Promise<{
      success: boolean;
      status: string;
      paymentIntentId: string;
      amount: number;
    }> => {
      const { data, error } = await supabase.functions.invoke('charge-saved-card', {
        body: { amount, paymentMethodId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['user-balance'] });
    },
  });
}
