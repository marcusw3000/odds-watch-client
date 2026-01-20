import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Types for secure data responses
export interface SecureBalance {
  balance_available: number;
  currency: string;
}

export interface SecurePortfolio {
  balance: number;
  totalInvested: number;
  totalProfit: number;
  contracts: Array<{
    id: string;
    eventId: string;
    eventTitle: string;
    outcome: 'YES' | 'NO';
    quantity: number;
    priceAtPurchase: number;
    purchasedAt: Date;
    status: 'ACTIVE' | 'WON' | 'LOST';
    payout?: number;
  }>;
  transactions: Array<{
    id: string;
    type: 'BUY' | 'SELL' | 'DEPOSIT' | 'PAYOUT';
    amount: number;
    eventTitle?: string;
    outcome?: 'YES' | 'NO';
    createdAt: Date;
  }>;
}

export interface AdminUser {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone?: string;
  balance_available: number;
  balance_locked: number;
  currency: string;
  is_blocked: boolean;
  blocked_at?: string;
  blocked_reason?: string;
  created_at: string;
  updated_at: string;
  roles: string[];
}

export interface AdminUsersPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminUsersFilters {
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'display_name' | 'email' | 'balance_available' | 'balance_total' | 'updated_at' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  filterBlocked?: boolean | null;
  filterRole?: string | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: AdminUsersPagination;
}

export interface UserDisplayInfo {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_public: boolean;
  bio?: string | null;
}

export interface LedgerEntrySecure {
  id: string;
  user_id: string;
  user_id_masked: string;
  wallet_id: string;
  ref_type: string;
  ref_id?: string;
  direction: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  platform_revenue: number;
  status: string;
  fee_snapshot_id?: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  total_profit: number | null;
  roi_percent: number | null;
  total_volume: number | null;
  total_trades: number | null;
  winning_trades: number | null;
  show_profit: boolean;
  show_roi: boolean;
  show_volume: boolean;
  show_trades: boolean;
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
    staleTime: 30000,
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
export function useAdminUsers(filters?: AdminUsersFilters) {
  const { isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['admin-users', filters],
    queryFn: async (): Promise<AdminUsersResponse> => {
      const { data, error } = await supabase.functions.invoke('get-admin-users', {
        method: 'POST',
        body: {
          search: filters?.search || '',
          limit: filters?.limit || 20,
          offset: filters?.offset || 0,
          sortBy: filters?.sortBy || 'updated_at',
          sortOrder: filters?.sortOrder || 'desc',
          filterBlocked: filters?.filterBlocked ?? null,
          filterRole: filters?.filterRole ?? null,
        },
      });
      
      if (error) {
        console.error('Error fetching admin users:', error);
        throw error;
      }
      
      return {
        users: (data as any).users as AdminUser[],
        pagination: (data as any).pagination as AdminUsersPagination,
      };
    },
    enabled: isAdmin,
    staleTime: 30000,
  });
}

// Fetch user display info securely via Edge Function
export function useUserDisplayInfo(userId: string | null) {
  return useQuery({
    queryKey: ['user-display-info', userId],
    queryFn: async (): Promise<UserDisplayInfo | null> => {
      if (!userId) return null;
      
      const { data, error } = await supabase.functions.invoke(
        `get-user-display-info?user_id=${encodeURIComponent(userId)}`
      );
      
      if (error) {
        console.error('Error fetching user display info:', error);
        return null;
      }
      
      return data as UserDisplayInfo;
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minuto - mais responsivo a atualizações de perfil
  });
}

// Fetch admin ledger entries via Edge Function
export function useAdminLedger(filters?: {
  userId?: string;
  refType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin-ledger', filters],
    queryFn: async (): Promise<LedgerEntrySecure[]> => {
      const { data, error } = await supabase.functions.invoke('get-admin-ledger', {
        method: 'POST',
        body: {
          userId: filters?.userId || undefined,
          refType: filters?.refType && filters.refType !== 'all' ? filters.refType : undefined,
          status: filters?.status && filters.status !== 'all' ? filters.status : undefined,
          startDate: filters?.startDate || undefined,
          endDate: filters?.endDate || undefined,
          minAmount: filters?.minAmount,
          maxAmount: filters?.maxAmount,
          limit: filters?.limit || 100,
          offset: filters?.offset || 0,
        },
      });
      
      if (error) {
        console.error('Error fetching admin ledger:', error);
        throw error;
      }
      
      return (data as any).entries as LedgerEntrySecure[];
    },
    enabled: isAdmin,
    staleTime: 30000,
  });
}

// Adjust wallet balance (admin only)
export function useAdjustWalletBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { walletId: string; amount: number; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('adjust-wallet-balance', {
        body: params,
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to adjust balance');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ledger'] });
    },
  });
}

// Manage user roles (admin only)
export function useManageUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { userId: string; action: 'add' | 'remove'; role: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-user-roles', {
        body: { 
          user_id: params.userId, 
          action: params.action, 
          role: params.role 
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to manage role');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

// Admin user details interface
export interface AdminUserDetails {
  profile: {
    id: string;
    display_name: string;
    full_name: string;
    email: string;
    phone?: string;
    cpf?: string;
    avatar_url?: string;
    bio?: string;
    is_public: boolean;
    is_blocked: boolean;
    blocked_at?: string;
    blocked_reason?: string;
    blocked_by?: string;
    created_at: string;
    updated_at: string;
  };
  wallet: {
    id: string;
    balance_available: number;
    balance_locked: number;
    currency: string;
    created_at: string;
    updated_at: string;
  } | null;
  roles: string[];
  contracts: Array<{
    id: string;
    market_id: string;
    market_title: string;
    market_status: string;
    market_result: string | null;
    position: string;
    shares: number;
    average_price: number;
    total_invested: number;
    created_at: string;
    option_id: string | null;
  }>;
  contractStats: {
    total: number;
    active: number;
    won: number;
    lost: number;
  };
  ledgerEntries: Array<{
    id: string;
    ref_type: string;
    direction: string;
    amount: number;
    net_amount: number;
    status: string;
    created_at: string;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
  }>;
  referralStats: {
    total: number;
    activated: number;
    pending: number;
  };
  auditLogs: Array<{
    id: string;
    action_type: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
}

// Fetch admin user details (admin only)
export function useAdminUserDetails(userId: string | null) {
  const { isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['admin-user-details', userId],
    queryFn: async (): Promise<AdminUserDetails | null> => {
      if (!userId) return null;
      
      const { data, error } = await supabase.functions.invoke('get-admin-user-details', {
        body: { user_id: userId },
      });
      
      if (error) {
        console.error('Error fetching admin user details:', error);
        throw error;
      }
      
      return data as AdminUserDetails;
    },
    enabled: isAdmin && !!userId,
    staleTime: 30000,
  });
}

// Block/unblock user (admin only)
export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { userId: string; action: 'block' | 'unblock'; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('block-user', {
        body: { 
          user_id: params.userId, 
          action: params.action, 
          reason: params.reason 
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to update user status');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] });
    },
  });
}

// Send admin warning (admin only)
export function useSendAdminWarning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { 
      userId: string; 
      message: string; 
      category?: 'warning' | 'reminder' | 'alert';
      sendEmail?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-send-warning', {
        body: { 
          user_id: params.userId, 
          message: params.message,
          category: params.category || 'warning',
          send_email: params.sendEmail || false,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send warning');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] });
    },
  });
}

// Fetch fee policy snapshot (admin only)
export function useFeePolicySnapshot(snapshotId: string | null) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['fee-policy-snapshot', snapshotId],
    queryFn: async () => {
      if (!snapshotId) return null;
      
      const { data, error } = await supabase.functions.invoke(`get-fee-policy-snapshot?id=${snapshotId}`);
      
      if (error) {
        console.error('Error fetching fee policy snapshot:', error);
        throw error;
      }
      
      return (data as any).snapshot;
    },
    enabled: isAdmin && !!snapshotId,
    staleTime: 300000,
  });
}

// Get leaderboard data via Edge Function
export function useSecureLeaderboard(sortBy: string = 'profit', limit: number = 50) {
  return useQuery({
    queryKey: ['secure-leaderboard', sortBy, limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const { data, error } = await supabase.functions.invoke(
        `get-leaderboard-data?sortBy=${sortBy}&limit=${limit}`
      );
      
      if (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
      }
      
      return (data as any).entries as LeaderboardEntry[];
    },
    staleTime: 60000,
  });
}

// Search users for mentions via Edge Function
export function useSearchUsersForMention(query: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['search-users-mention', query],
    queryFn: async (): Promise<Array<{ user_id: string; display_name: string }>> => {
      if (!query || query.length < 2) return [];
      
      const { data, error } = await supabase.functions.invoke(
        `search-users-mention?q=${encodeURIComponent(query)}`
      );
      
      if (error) {
        console.error('Error searching users for mention:', error);
        return [];
      }
      
      return (data as any).users || [];
    },
    enabled: !!user && query.length >= 2,
    staleTime: 30000,
  });
}

// Hook to invalidate secure data caches
export function useSecureDataRefresh() {
  const queryClient = useQueryClient();
  
  return {
    refreshBalance: () => queryClient.invalidateQueries({ queryKey: ['secure-balance'] }),
    refreshPortfolio: () => queryClient.invalidateQueries({ queryKey: ['secure-portfolio'] }),
    refreshLeaderboard: () => queryClient.invalidateQueries({ queryKey: ['secure-leaderboard'] }),
    refreshAdminUsers: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    refreshAdminLedger: () => queryClient.invalidateQueries({ queryKey: ['admin-ledger'] }),
    refreshAll: () => {
      queryClient.invalidateQueries({ queryKey: ['secure-balance'] });
      queryClient.invalidateQueries({ queryKey: ['secure-portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['secure-leaderboard'] });
    },
  };
}
