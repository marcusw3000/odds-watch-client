import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UserPortfolio, UserContract, Transaction } from '@/types/market';

// Types for secure data responses
export interface SecureBalance {
  balance_available: number;
  currency: string;
}

export interface SecurePortfolio {
  balance: number;
  totalInvested: number;
  totalProfit: number;
  contracts: UserContract[];
  transactions: Transaction[];
}

export interface AdminUser {
  id: string;
  user_id: string;
  display_name: string;
  email_masked: string;
  balance_available: number;
  balance_locked: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface UserDisplayInfo {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_public: boolean;
  bio?: string | null;
}

// Fetch user balance securely via Edge Function
export function useSecureBalance() {
  return useQuery({
    queryKey: ['secure-balance'],
    queryFn: async (): Promise<SecureBalance> => {
      const { data, error } = await supabase.functions.invoke('get-user-balance');
      
      if (error) {
        console.error('Error fetching secure balance:', error);
        throw error;
      }
      
      return data as SecureBalance;
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

// Fetch user portfolio securely via Edge Function
export function useSecurePortfolio() {
  return useQuery({
    queryKey: ['secure-portfolio'],
    queryFn: async (): Promise<SecurePortfolio> => {
      const { data, error } = await supabase.functions.invoke('get-user-portfolio');
      
      if (error) {
        console.error('Error fetching secure portfolio:', error);
        throw error;
      }
      
      // Transform dates from strings
      const portfolio = data as any;
      return {
        balance: portfolio.balance,
        totalInvested: portfolio.totalInvested,
        totalProfit: portfolio.totalProfit,
        contracts: (portfolio.contracts || []).map((c: any) => ({
          ...c,
          purchasedAt: new Date(c.purchasedAt),
        })),
        transactions: (portfolio.transactions || []).map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
        })),
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

// Fetch admin users securely via Edge Function
export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: ['admin-users', search],
    queryFn: async (): Promise<AdminUser[]> => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      
      const { data, error } = await supabase.functions.invoke('get-admin-users', {
        body: { search },
      });
      
      if (error) {
        console.error('Error fetching admin users:', error);
        throw error;
      }
      
      return (data as any).users as AdminUser[];
    },
    staleTime: 60000, // 1 minute
  });
}

// Fetch user display info securely via Edge Function
export function useUserDisplayInfo(userId: string | null) {
  return useQuery({
    queryKey: ['user-display-info', userId],
    queryFn: async (): Promise<UserDisplayInfo | null> => {
      if (!userId) return null;
      
      const { data, error } = await supabase.functions.invoke('get-user-display-info', {
        body: { user_id: userId },
      });
      
      if (error) {
        console.error('Error fetching user display info:', error);
        return null;
      }
      
      return data as UserDisplayInfo;
    },
    enabled: !!userId,
    staleTime: 300000, // 5 minutes
  });
}

// Hook to invalidate secure data caches
export function useSecureDataRefresh() {
  const queryClient = useQueryClient();
  
  return {
    refreshBalance: () => queryClient.invalidateQueries({ queryKey: ['secure-balance'] }),
    refreshPortfolio: () => queryClient.invalidateQueries({ queryKey: ['secure-portfolio'] }),
    refreshAll: () => {
      queryClient.invalidateQueries({ queryKey: ['secure-balance'] });
      queryClient.invalidateQueries({ queryKey: ['secure-portfolio'] });
    },
  };
}
