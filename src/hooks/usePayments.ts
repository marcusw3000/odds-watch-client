import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Payment, WithdrawalRequest } from '@/types/payment';

export function usePayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payments', user?.id],
    queryFn: async (): Promise<Payment[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Payment[];
    },
    enabled: !!user,
  });
}

export function usePendingPayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-payments', user?.id],
    queryFn: async (): Promise<Payment[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['PENDING', 'PROCESSING'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Payment[];
    },
    enabled: !!user,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amount: number): Promise<{ url: string; sessionId: string }> => {
      const { data, error } = await supabase.functions.invoke('create-deposit', {
        body: { amount },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
    },
  });
}

export function useVerifyDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<{ success: boolean; amount?: number; message: string }> => {
      const { data, error } = await supabase.functions.invoke('verify-deposit', {
        body: { session_id: sessionId },
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

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: WithdrawalRequest): Promise<{ 
      success: boolean; 
      payment_id: string;
      amount: number;
      fee: number;
      net_amount: number;
      message: string;
    }> => {
      const { data, error } = await supabase.functions.invoke('request-withdrawal', {
        body: request,
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
