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

      case 'TIERED': {
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

}
