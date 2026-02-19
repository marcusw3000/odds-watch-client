// ============= Financial Repository =============
// Data access layer for financial entities

import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, Json } from '@/integrations/supabase/types';
import type {
  FeeRule,
  LedgerEntry,
  AdminAuditLog,
  Wallet,
  WalletWithProfile,
  PlatformRevenue,
  FinancialMetrics,
  RevenueByDay,
  FeeType,
  FeePolicySnapshot
} from '@/types/financial';

export class FinancialRepository {
  // ==================== FEE RULES ====================

  static async getAllFeeRules(): Promise<FeeRule[]> {
    const { data, error } = await supabase
      .from('fee_rules')
      .select('*')
      .order('type')
      .order('effective_from', { ascending: false });

    if (error) {
      console.error('Error fetching fee rules:', error);
      return [];
    }

    return data as unknown as FeeRule[];
  }

  static async getFeeRuleById(id: string): Promise<FeeRule | null> {
    const { data, error } = await supabase
      .from('fee_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching fee rule:', error);
      return null;
    }

    return data as unknown as FeeRule;
  }

  static async createFeeRule(rule: Omit<FeeRule, 'id' | 'created_at'>): Promise<FeeRule | null> {
    const insertData: TablesInsert<'fee_rules'> = {
      name: rule.name,
      type: rule.type,
      mode: rule.mode,
      tiers: rule.tiers as unknown as Json,
      flat_value: rule.flat_value,
      percent_value: rule.percent_value,
      min_fee: rule.min_fee,
      max_fee: rule.max_fee,
      is_active: rule.is_active,
      effective_from: rule.effective_from,
      created_by: rule.created_by
    };
    
    const { data, error } = await supabase
      .from('fee_rules')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating fee rule:', error);
      return null;
    }

    return data as unknown as FeeRule;
  }

  static async updateFeeRule(id: string, updates: Partial<FeeRule>): Promise<FeeRule | null> {
    const { data, error } = await supabase
      .from('fee_rules')
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating fee rule:', error);
      return null;
    }

    return data as unknown as FeeRule;
  }

  static async deactivateFeeRule(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('fee_rules')
      .update({ is_active: false })
      .eq('id', id);

    return !error;
  }

  // ==================== LEDGER ENTRIES ====================

  static async getLedgerEntries(filters?: {
    userId?: string;
    refType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }): Promise<LedgerEntry[]> {
    let query = supabase
      .from('ledger_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.refType) {
      query = query.eq('ref_type', filters.refType);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters?.minAmount !== undefined) {
      query = query.gte('amount', filters.minAmount);
    }
    if (filters?.maxAmount !== undefined) {
      query = query.lte('amount', filters.maxAmount);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching ledger entries:', error);
      return [];
    }

    return data as unknown as LedgerEntry[];
  }

  static async getLedgerEntryById(id: string): Promise<LedgerEntry | null> {
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching ledger entry:', error);
      return null;
    }

    return data as unknown as LedgerEntry;
  }

  static async getFeePolicySnapshot(id: string): Promise<FeePolicySnapshot | null> {
    const { data, error } = await supabase
      .from('fee_policy_snapshots')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching fee snapshot:', error);
      return null;
    }

    return data as unknown as FeePolicySnapshot;
  }

  // ==================== WALLETS ====================

  static async getAllWalletsWithProfiles(): Promise<WalletWithProfile[]> {
    // First get all wallets
    const { data: walletsData, error: walletsError } = await supabase
      .from('wallets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (walletsError || !walletsData) {
      console.error('Error fetching wallets:', walletsError);
      return [];
    }

    // Get user IDs
    const userIds = walletsData.map(w => w.user_id);

    // Fetch profiles for these users
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // Create a map of profiles
    const profilesMap = new Map<string, { email: string | null; full_name: string | null }>();
    (profilesData || []).forEach(p => {
      profilesMap.set(p.id, { email: p.email, full_name: p.full_name });
    });

    // Combine data
    return walletsData.map(wallet => ({
      id: wallet.id,
      user_id: wallet.user_id,
      balance_available: wallet.balance_available,
      balance_locked: wallet.balance_locked,
      currency: wallet.currency,
      created_at: wallet.created_at,
      updated_at: wallet.updated_at,
      email: profilesMap.get(wallet.user_id)?.email ?? null,
      full_name: profilesMap.get(wallet.user_id)?.full_name ?? null
    })) as WalletWithProfile[];
  }

  static async getAllWallets(): Promise<Wallet[]> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching wallets:', error);
      return [];
    }

    return data as unknown as Wallet[];
  }

  static async getWalletByUserId(userId: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching wallet:', error);
      return null;
    }

    return data as unknown as Wallet;
  }

  // NOTE: createWallet() and adjustWalletBalance() were removed.
  // These operations are handled exclusively via Edge Functions
  // (adjust-wallet-balance, create-deposit, handle_new_user_wallet trigger).

  // ==================== PLATFORM REVENUE ====================

  static async getPlatformRevenue(startDate: string, endDate: string): Promise<PlatformRevenue[]> {
    const { data, error } = await supabase
      .from('platform_revenue')
      .select('*')
      .gte('day', startDate)
      .lte('day', endDate)
      .order('day', { ascending: false });

    if (error) {
      console.error('Error fetching platform revenue:', error);
      return [];
    }

    return data as unknown as PlatformRevenue[];
  }

  static async getRevenueByDay(days: number = 14): Promise<RevenueByDay[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('platform_revenue')
      .select('day, fees, type')
      .gte('day', startDate.toISOString().split('T')[0])
      .order('day', { ascending: true });

    if (error) {
      console.error('Error fetching revenue by day:', error);
      return [];
    }

    return (data || []).map(d => ({
      day: d.day,
      amount: Number(d.fees),
      type: d.type
    }));
  }

  static async getRevenueByType(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('platform_revenue')
      .select('type, fees');

    if (error) {
      console.error('Error fetching revenue by type:', error);
      return {};
    }

    const result: Record<string, number> = {};
    for (const row of data || []) {
      result[row.type] = (result[row.type] || 0) + Number(row.fees);
    }
    return result;
  }

  // ==================== AUDIT LOGS ====================

  static async getAuditLogs(filters?: {
    actorUserId?: string;
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminAuditLog[]> {
    let query = supabase
      .from('admin_audit_logs')
      .select('*, profiles:actor_user_id(display_name)')
      .order('created_at', { ascending: false });

    if (filters?.actorUserId) {
      query = query.eq('actor_user_id', filters.actorUserId);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.entity) {
      query = query.eq('entity', filters.entity);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 25) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return data as unknown as AdminAuditLog[];
  }

  // ==================== METRICS ====================

  static async getFinancialMetrics(): Promise<FinancialMetrics> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const date7DaysAgo = new Date(today);
    date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
    
    const date30DaysAgo = new Date(today);
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

    // Revenue queries
    const [todayRevenue, week7Revenue, month30Revenue] = await Promise.all([
      supabase.from('platform_revenue').select('fees').eq('day', todayStr),
      supabase.from('platform_revenue').select('fees').gte('day', date7DaysAgo.toISOString().split('T')[0]),
      supabase.from('platform_revenue').select('fees').gte('day', date30DaysAgo.toISOString().split('T')[0])
    ]);

    // Transaction counts
    const [deposits, withdrawals, trades] = await Promise.all([
      supabase.from('ledger_entries').select('id', { count: 'exact' }).eq('ref_type', 'DEPOSIT'),
      supabase.from('ledger_entries').select('id', { count: 'exact' }).eq('ref_type', 'WITHDRAW'),
      supabase.from('ledger_entries').select('id', { count: 'exact' }).eq('ref_type', 'TRADE')
    ]);

    // Average fees by type
    const avgFeeByType: Record<FeeType, number> = {
      DEPOSIT: 0,
      WITHDRAW: 0,
      TRADE: 0,
      SETTLEMENT: 0
    };

    for (const type of ['DEPOSIT', 'WITHDRAW', 'TRADE', 'SETTLEMENT'] as FeeType[]) {
      const { data } = await supabase
        .from('ledger_entries')
        .select('fee_amount')
        .eq('ref_type', type);
      
      if (data && data.length > 0) {
        const total = data.reduce((sum, e) => sum + Number(e.fee_amount), 0);
        avgFeeByType[type] = total / data.length;
      }
    }

    // Active users (users with wallets)
    const { count: activeUsers } = await supabase
      .from('wallets')
      .select('id', { count: 'exact' });

    const sumFees = (data: { fees: number }[] | null) => 
      (data || []).reduce((sum, r) => sum + Number(r.fees), 0);

    return {
      revenueToday: sumFees(todayRevenue.data),
      revenue7Days: sumFees(week7Revenue.data),
      revenue30Days: sumFees(month30Revenue.data),
      totalDeposits: deposits.count || 0,
      totalWithdrawals: withdrawals.count || 0,
      totalTrades: trades.count || 0,
      avgFeeByType,
      activeUsers: activeUsers || 0
    };
  }

  // ==================== MARKETS / EVENTS ====================

  static async getMarketsForSettlement() {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .in('status', ['OPEN', 'HALTED', 'PENDING'])
      .order('close_date', { ascending: true });

    if (error) {
      console.error('Error fetching markets:', error);
      return [];
    }

    return data;
  }

  static async settleMarket(
    marketId: string, 
    result: 'YES' | 'NO', 
    evidenceUrl: string,
    settledBy: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('markets')
      .update({
        status: 'SETTLED',
        result,
        resolution: {
          result,
          evidence_url: evidenceUrl,
          settled_at: new Date().toISOString()
        },
        settled_by: settledBy
      })
      .eq('id', marketId);

    return !error;
  }
}
