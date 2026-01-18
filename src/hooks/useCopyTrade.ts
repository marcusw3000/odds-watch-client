import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  CopyTradeSettings, 
  CopyTrader, 
  CopySubscription,
  CopiedTrade,
  CopyTradeCommission 
} from '@/types/copyTrade';

// Fetch global copy trade settings
export function useCopyTradeSettings() {
  return useQuery({
    queryKey: ['copy-trade-settings'],
    queryFn: async (): Promise<CopyTradeSettings> => {
      const { data, error } = await supabase
        .from('copy_trade_settings')
        .select('*')
        .single();

      if (error) throw error;
      return data as CopyTradeSettings;
    },
  });
}

// Update copy trade settings (admin only)
export function useUpdateCopyTradeSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<CopyTradeSettings>) => {
      const { data, error } = await supabase
        .from('copy_trade_settings')
        .update({
          ...settings,
          default_platform_split: 100 - (settings.default_trader_split ?? 50),
          updated_at: new Date().toISOString(),
        })
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copy-trade-settings'] });
      toast.success('Configurações atualizadas');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar configurações: ' + error.message);
    },
  });
}

// Fetch all copy traders (for admin)
export function useCopyTraders(status?: string) {
  return useQuery({
    queryKey: ['copy-traders', status],
    queryFn: async (): Promise<CopyTrader[]> => {
      let query = supabase
        .from('copy_traders')
        .select(`
          *,
          profile:profiles!copy_traders_user_id_fkey(
            email,
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as CopyTrader[];
    },
  });
}

// Fetch approved copy traders (public)
export function useApprovedCopyTraders() {
  return useQuery({
    queryKey: ['copy-traders', 'approved'],
    queryFn: async (): Promise<CopyTrader[]> => {
      const { data, error } = await supabase
        .from('copy_traders')
        .select('*')
        .eq('status', 'APPROVED')
        .order('total_followers', { ascending: false });

      if (error) throw error;
      return (data || []) as CopyTrader[];
    },
  });
}

// Fetch single copy trader
export function useCopyTrader(traderId: string | null) {
  return useQuery({
    queryKey: ['copy-trader', traderId],
    queryFn: async (): Promise<CopyTrader | null> => {
      if (!traderId) return null;

      const { data, error } = await supabase
        .from('copy_traders')
        .select('*')
        .eq('id', traderId)
        .single();

      if (error) throw error;
      return data as CopyTrader;
    },
    enabled: !!traderId,
  });
}

// Check if current user is a copy trader
export function useMyTraderStatus() {
  return useQuery({
    queryKey: ['my-trader-status'],
    queryFn: async (): Promise<CopyTrader | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('copy_traders')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as CopyTrader | null;
    },
  });
}

// Apply to become a copy trader
export function useApplyCopyTrader() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ display_name, bio }: { display_name: string; bio: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('copy_traders')
        .insert({
          user_id: user.id,
          display_name,
          bio,
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-trader-status'] });
      toast.success('Solicitação enviada! Aguarde aprovação do admin.');
    },
    onError: (error) => {
      toast.error('Erro ao enviar solicitação: ' + error.message);
    },
  });
}

// Manage copy trader (admin actions)
export function useManageCopyTrader() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      trader_id,
      rejection_reason,
      monthly_fee,
      profit_share_percent,
      custom_trader_split,
      custom_platform_split,
    }: {
      action: 'approve' | 'reject' | 'suspend' | 'unsuspend';
      trader_id: string;
      rejection_reason?: string;
      monthly_fee?: number;
      profit_share_percent?: number;
      custom_trader_split?: number;
      custom_platform_split?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      let updateData: Record<string, unknown> = {};

      switch (action) {
        case 'approve':
          updateData = {
            status: 'APPROVED',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            rejection_reason: null,
            suspended_at: null,
            monthly_fee,
            profit_share_percent,
            custom_trader_split,
            custom_platform_split: custom_trader_split ? 100 - custom_trader_split : null,
          };
          break;
        case 'reject':
          updateData = {
            status: 'REJECTED',
            rejection_reason,
          };
          break;
        case 'suspend':
          updateData = {
            status: 'SUSPENDED',
            suspended_at: new Date().toISOString(),
          };
          break;
        case 'unsuspend':
          updateData = {
            status: 'APPROVED',
            suspended_at: null,
          };
          break;
      }

      const { data, error } = await supabase
        .from('copy_traders')
        .update(updateData)
        .eq('id', trader_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['copy-traders'] });
      queryClient.invalidateQueries({ queryKey: ['copy-trader', variables.trader_id] });
      
      const messages = {
        approve: 'Trader aprovado com sucesso!',
        reject: 'Trader rejeitado.',
        suspend: 'Trader suspenso.',
        unsuspend: 'Trader reativado.',
      };
      toast.success(messages[variables.action]);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    },
  });
}

// Update trader settings (admin)
export function useUpdateTraderSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      trader_id,
      monthly_fee,
      profit_share_percent,
      custom_trader_split,
    }: {
      trader_id: string;
      monthly_fee?: number;
      profit_share_percent?: number;
      custom_trader_split?: number | null;
    }) => {
      const { data, error } = await supabase
        .from('copy_traders')
        .update({
          monthly_fee,
          profit_share_percent,
          custom_trader_split,
          custom_platform_split: custom_trader_split != null ? 100 - custom_trader_split : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trader_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['copy-traders'] });
      queryClient.invalidateQueries({ queryKey: ['copy-trader', variables.trader_id] });
      toast.success('Configurações do trader atualizadas');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    },
  });
}

// Fetch user's copy subscriptions
export function useMyCopySubscriptions() {
  return useQuery({
    queryKey: ['my-copy-subscriptions'],
    queryFn: async (): Promise<CopySubscription[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('copy_subscriptions')
        .select(`
          *,
          trader:copy_traders(*)
        `)
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CopySubscription[];
    },
  });
}

// Fetch trader's followers (for trader dashboard)
export function useMyFollowers() {
  return useQuery({
    queryKey: ['my-followers'],
    queryFn: async (): Promise<CopySubscription[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // First get my trader id
      const { data: traderData } = await supabase
        .from('copy_traders')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!traderData) return [];

      const { data, error } = await supabase
        .from('copy_subscriptions')
        .select('*')
        .eq('trader_id', traderData.id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CopySubscription[];
    },
  });
}

// Fetch copied trades for a subscription
export function useCopiedTrades(subscriptionId: string | null) {
  return useQuery({
    queryKey: ['copied-trades', subscriptionId],
    queryFn: async (): Promise<CopiedTrade[]> => {
      if (!subscriptionId) return [];

      const { data, error } = await supabase
        .from('copied_trades')
        .select(`
          *,
          market:markets(title, status)
        `)
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CopiedTrade[];
    },
    enabled: !!subscriptionId,
  });
}

// Fetch commissions for trader dashboard
export function useMyCommissions() {
  return useQuery({
    queryKey: ['my-commissions'],
    queryFn: async (): Promise<CopyTradeCommission[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: traderData } = await supabase
        .from('copy_traders')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!traderData) return [];

      const { data, error } = await supabase
        .from('copy_trade_commissions')
        .select('*')
        .eq('trader_id', traderData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as CopyTradeCommission[];
    },
  });
}

// Admin stats
export function useCopyTradeStats() {
  return useQuery({
    queryKey: ['copy-trade-stats'],
    queryFn: async () => {
      const [tradersResult, subsResult, commissionsResult] = await Promise.all([
        supabase.from('copy_traders').select('status', { count: 'exact' }),
        supabase.from('copy_subscriptions').select('status', { count: 'exact' }),
        supabase.from('copy_trade_commissions').select('platform_share'),
      ]);

      const traders = tradersResult.data || [];
      const subs = subsResult.data || [];
      const commissions = commissionsResult.data || [];

      const pendingTraders = traders.filter(t => t.status === 'PENDING').length;
      const approvedTraders = traders.filter(t => t.status === 'APPROVED').length;
      const activeSubscriptions = subs.filter(s => s.status === 'ACTIVE').length;
      const platformRevenue = commissions.reduce((sum, c) => sum + (c.platform_share || 0), 0);

      return {
        pendingTraders,
        approvedTraders,
        activeSubscriptions,
        platformRevenue,
        totalTraders: traders.length,
        totalSubscriptions: subs.length,
      };
    },
  });
}
