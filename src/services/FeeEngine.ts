// ============= Fee Engine Service =============
// Central service for calculating and applying fees

import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, Json } from '@/integrations/supabase/types';
import type { 
  FeeType, 
  FeeRule, 
  FeeTier, 
  FeeCalculationResult,
  LedgerRefType,
  LedgerDirection
} from '@/types/financial';

export class FeeEngine {
  /**
   * Get active fee rule for a specific type
   */
  static async getActiveRule(type: FeeType): Promise<FeeRule | null> {
    const { data, error } = await supabase
      .from('fee_rules')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .lte('effective_from', new Date().toISOString())
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching fee rule:', error);
      return null;
    }

    return data as unknown as FeeRule;
  }

  /**
   * Calculate trading fee - currently disabled (returns 0)
   */
  static calculateTradingFee(contracts: number, pricePerContract: number): number {
    return 0;
  }

  /**
   * Calculate fee based on amount and rule (legacy method for non-trade operations)
   */
  static calculateFee(amount: number, rule: FeeRule): FeeCalculationResult {
    let feeAmount = 0;
    let appliedTier: FeeTier | undefined;

    switch (rule.mode) {
      case 'FIXED':
        feeAmount = rule.flat_value || 0;
        break;

      case 'PERCENT':
        feeAmount = amount * (rule.percent_value || 0);
        break;

      case 'TIERED':
        const tiers = rule.tiers || [];
        for (const tier of tiers) {
          if (amount >= tier.min && (tier.max === null || amount < tier.max)) {
            feeAmount = amount * tier.percent;
            appliedTier = tier;
            break;
          }
        }
        break;
    }

    // Apply min/max fee constraints
    if (rule.min_fee !== null && feeAmount < rule.min_fee) {
      feeAmount = rule.min_fee;
    }
    if (rule.max_fee !== null && feeAmount > rule.max_fee) {
      feeAmount = rule.max_fee;
    }

    // Round to 2 decimal places
    feeAmount = Math.round(feeAmount * 100) / 100;
    const netAmount = Math.round((amount - feeAmount) * 100) / 100;

    return {
      feeAmount,
      netAmount,
      appliedRule: rule,
      tier: appliedTier
    };
  }

  /**
   * Calculate trading fee with full result object - currently disabled
   */
  static calculateTradeFee(
    contracts: number, 
    pricePerContract: number,
    totalCost: number
  ): FeeCalculationResult {
    return {
      feeAmount: 0,
      netAmount: totalCost,
      appliedRule: {
        id: 'no-fee',
        name: 'Sem Taxa',
        type: 'TRADE',
        mode: 'FIXED',
        percent_value: null,
        flat_value: 0,
        tiers: [],
        min_fee: null,
        max_fee: null,
        is_active: true,
        effective_from: new Date().toISOString(),
        created_at: new Date().toISOString(),
        created_by: null
      },
      tier: undefined
    };
  }

  /**
   * Create a fee policy snapshot for audit trail
   */
  static async createSnapshot(
    rule: FeeRule,
    appliedTier?: FeeTier
  ): Promise<string | null> {
    const insertData: TablesInsert<'fee_policy_snapshots'> = {
      fee_rule_id: rule.id,
      type: rule.type,
      applied_mode: rule.mode,
      applied_tiers: (appliedTier ? [appliedTier] : rule.tiers) as unknown as Json,
      applied_percent: rule.percent_value,
      applied_flat: rule.flat_value
    };
    
    const { data, error } = await supabase
      .from('fee_policy_snapshots')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating fee snapshot:', error);
      return null;
    }

    return data.id;
  }

  /**
   * Record a ledger entry (immutable)
   */
  static async recordLedgerEntry(params: {
    userId: string | null;
    walletId: string | null;
    refType: LedgerRefType;
    refId: string | null;
    direction: LedgerDirection;
    amount: number;
    feeAmount: number;
    netAmount: number;
    platformRevenue: number;
    feeSnapshotId: string | null;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    meta?: Record<string, unknown>;
  }): Promise<string | null> {
    const insertData: TablesInsert<'ledger_entries'> = {
      user_id: params.userId,
      wallet_id: params.walletId,
      ref_type: params.refType,
      ref_id: params.refId,
      direction: params.direction,
      amount: params.amount,
      fee_amount: params.feeAmount,
      net_amount: params.netAmount,
      platform_revenue: params.platformRevenue,
      fee_snapshot_id: params.feeSnapshotId,
      status: params.status,
      meta: (params.meta || {}) as Json
    };
    
    const { data, error } = await supabase
      .from('ledger_entries')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('Error recording ledger entry:', error);
      return null;
    }

    return data.id;
  }

  /**
   * Update wallet balance
   */
  static async updateWalletBalance(
    walletId: string,
    availableDelta: number,
    lockedDelta: number = 0
  ): Promise<boolean> {
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('balance_available, balance_locked')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet) {
      console.error('Error fetching wallet:', fetchError);
      return false;
    }

    const newAvailable = Number(wallet.balance_available) + availableDelta;
    const newLocked = Number(wallet.balance_locked) + lockedDelta;

    if (newAvailable < 0 || newLocked < 0) {
      console.error('Insufficient balance');
      return false;
    }

    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        balance_available: newAvailable,
        balance_locked: newLocked
      })
      .eq('id', walletId);

    if (updateError) {
      console.error('Error updating wallet:', updateError);
      return false;
    }

    return true;
  }

  /**
   * Aggregate platform revenue
   */
  static async aggregateRevenue(
    type: FeeType,
    amount: number
  ): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];

    // Try to upsert
    const { error } = await supabase
      .from('platform_revenue')
      .upsert(
        {
          day: today,
          type,
          fees: amount,
          gross: amount,
          net: amount
        },
        {
          onConflict: 'day,type'
        }
      );

    if (error) {
      console.error('Error aggregating revenue:', error);
      return false;
    }

    return true;
  }

  /**
   * Record audit log
   */
  static async recordAuditLog(params: {
    actorUserId: string;
    action: string;
    entity: string;
    entityId: string | null;
    beforeData?: Record<string, unknown>;
    afterData?: Record<string, unknown>;
  }): Promise<boolean> {
    const insertData: TablesInsert<'admin_audit_logs'> = {
      actor_user_id: params.actorUserId,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      before_data: (params.beforeData || null) as Json,
      after_data: (params.afterData || null) as Json
    };
    
    const { error } = await supabase
      .from('admin_audit_logs')
      .insert(insertData);

    if (error) {
      console.error('Error recording audit log:', error);
      return false;
    }

    return true;
  }

  /**
   * Process a complete transaction with fees
   */
  static async processTransaction(params: {
    userId: string;
    walletId: string;
    type: FeeType;
    amount: number;
    refId: string | null;
    meta?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    ledgerEntryId?: string;
    feeAmount?: number;
    netAmount?: number;
    error?: string;
  }> {
    try {
      // 1. Get active fee rule
      const rule = await this.getActiveRule(params.type);
      if (!rule) {
        return { success: false, error: 'No active fee rule found' };
      }

      // 2. Calculate fee
      const { feeAmount, netAmount, tier } = this.calculateFee(params.amount, rule);

      // 3. Create snapshot
      const snapshotId = await this.createSnapshot(rule, tier);

      // 4. Determine direction based on type
      const direction: LedgerDirection = 
        params.type === 'DEPOSIT' ? 'CREDIT' : 'DEBIT';

      // 5. Record ledger entry
      const ledgerEntryId = await this.recordLedgerEntry({
        userId: params.userId,
        walletId: params.walletId,
        refType: params.type,
        refId: params.refId,
        direction,
        amount: params.amount,
        feeAmount,
        netAmount,
        platformRevenue: feeAmount,
        feeSnapshotId: snapshotId,
        status: 'COMPLETED',
        meta: params.meta
      });

      if (!ledgerEntryId) {
        return { success: false, error: 'Failed to record ledger entry' };
      }

      // 6. Update wallet balance
      const balanceDelta = direction === 'CREDIT' ? netAmount : -params.amount;
      const walletUpdated = await this.updateWalletBalance(
        params.walletId,
        balanceDelta
      );

      if (!walletUpdated) {
        return { success: false, error: 'Failed to update wallet balance' };
      }

      // 7. Aggregate platform revenue
      await this.aggregateRevenue(params.type, feeAmount);

      return {
        success: true,
        ledgerEntryId,
        feeAmount,
        netAmount
      };
    } catch (error) {
      console.error('Transaction processing error:', error);
      return { success: false, error: 'Transaction processing failed' };
    }
  }
}
