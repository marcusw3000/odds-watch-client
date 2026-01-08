import { MarketEvent, MarketStatus, Contestation, DbMarket, SettlementType, SettlementConfig } from '@/types/market';
import { AdminMetrics, MarketFormData, ContestationReviewData, AuditLogEntry, ContestationWithEvent } from '@/types/admin';
import { supabase } from '@/integrations/supabase/client';
import { initializeLMSR, getPriceYes, getPriceNo, LMSRState } from './LMSRCalculator';

// Transform DB market to frontend MarketEvent
function transformDbMarket(dbMarket: DbMarket): MarketEvent {
  const lmsr: LMSRState = {
    b: dbMarket.lmsr_b,
    qYes: dbMarket.yes_shares,
    qNo: dbMarket.no_shares,
  };

  const yesPrice = getPriceYes(lmsr);
  const noPrice = getPriceNo(lmsr);

  return {
    id: dbMarket.id,
    title: dbMarket.title,
    category: dbMarket.category,
    description: dbMarket.description || undefined,
    imageUrl: dbMarket.image_url || undefined,
    status: dbMarket.status as MarketStatus,
    settlementType: dbMarket.settlement_type as SettlementType,
    settlementConfig: dbMarket.settlement_config as SettlementConfig | undefined,
    expiryAt: dbMarket.settlement_date ? new Date(dbMarket.settlement_date) : new Date(),
    tradingHaltAt: dbMarket.close_date ? new Date(dbMarket.close_date) : new Date(),
    eventAt: dbMarket.settlement_date ? new Date(dbMarket.settlement_date) : new Date(),
    limits: { minBuy: 10, maxBuy: 5000 },
    lastUpdatedAt: new Date(dbMarket.updated_at),
    volume: dbMarket.total_volume,
    outcomes: {
      YES: { price: yesPrice, probability: yesPrice },
      NO: { price: noPrice, probability: noPrice },
    },
    lmsr,
    result: dbMarket.result as 'YES' | 'NO' | undefined,
    resultSource: dbMarket.result_source || undefined,
    haltReason: dbMarket.halt_reason || undefined,
  };
}

export const AdminDataProvider = {
  // === MARKETS ===

  // Get all markets
  async getMarkets(): Promise<MarketEvent[]> {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching markets:', error);
      return [];
    }

    return (data || []).map(m => transformDbMarket(m as unknown as DbMarket));
  },

  // Get single market
  async getMarket(id: string): Promise<MarketEvent | null> {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching market:', error);
      return null;
    }

    return transformDbMarket(data as unknown as DbMarket);
  },

  // Create new market
  async createMarket(formData: MarketFormData): Promise<MarketEvent> {
    const lmsrState = initializeLMSR(formData.initialYesOdds, formData.liquidity);
    const yesPrice = getPriceYes(lmsrState);
    const noPrice = getPriceNo(lmsrState);

    const { data, error } = await supabase
      .from('markets')
      .insert([{
        title: formData.title,
        category: formData.category,
        description: formData.description || null,
        status: 'OPEN' as const,
        settlement_type: (formData.settlementType || 'MANUAL') as any,
        settlement_config: (formData.settlementConfig || null) as any,
        close_date: formData.tradingHaltAt.toISOString(),
        settlement_date: formData.eventAt.toISOString(),
        lmsr_b: formData.liquidity,
        yes_shares: lmsrState.qYes,
        no_shares: lmsrState.qNo,
        current_yes_price: yesPrice / 100,
        current_no_price: noPrice / 100,
        total_volume: 0,
        liquidity_pool: formData.liquidity * 100,
      }])
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating market:', error);
      throw new Error('Failed to create market');
    }

    return transformDbMarket(data as unknown as DbMarket);
  },

  // Update market
  async updateMarket(id: string, formData: Partial<MarketFormData>): Promise<MarketEvent | null> {
    const updates: Record<string, any> = {};
    
    if (formData.title) updates.title = formData.title;
    if (formData.category) updates.category = formData.category;
    if (formData.description !== undefined) updates.description = formData.description || null;
    if (formData.tradingHaltAt) updates.close_date = formData.tradingHaltAt.toISOString();
    if (formData.eventAt) updates.settlement_date = formData.eventAt.toISOString();
    if (formData.settlementType) updates.settlement_type = formData.settlementType;
    if (formData.settlementConfig) updates.settlement_config = formData.settlementConfig;
    
    if (formData.liquidity) {
      updates.lmsr_b = formData.liquidity;
    }

    const { data, error } = await supabase
      .from('markets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating market:', error);
      return null;
    }

    return transformDbMarket(data as unknown as DbMarket);
  },

  // Delete market (only if no contracts)
  async deleteMarket(id: string): Promise<{ success: boolean; message: string }> {
    // Check for existing contracts
    const { data: contracts } = await supabase
      .from('user_contracts')
      .select('id')
      .eq('market_id', id)
      .limit(1);

    if (contracts && contracts.length > 0) {
      return { success: false, message: 'Não é possível excluir mercado com contratos ativos.' };
    }

    const { error } = await supabase
      .from('markets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting market:', error);
      return { success: false, message: 'Erro ao excluir mercado.' };
    }

    return { success: true, message: 'Mercado excluído com sucesso.' };
  },

  // === STATUS CONTROL ===

  // Force halt (emergency)
  async forceHalt(eventId: string, reason: string): Promise<MarketEvent | null> {
    const { data, error } = await supabase
      .from('markets')
      .update({ status: 'HALTED', halt_reason: reason })
      .eq('id', eventId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error halting market:', error);
      return null;
    }

    return transformDbMarket(data as unknown as DbMarket);
  },

  // Resume trading
  async resumeTrading(eventId: string): Promise<MarketEvent | null> {
    const { data, error } = await supabase
      .from('markets')
      .update({ status: 'OPEN', halt_reason: null })
      .eq('id', eventId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error resuming market:', error);
      return null;
    }

    return transformDbMarket(data as unknown as DbMarket);
  },

  // Update lifecycle timestamps
  async updateLifecycle(
    eventId: string, 
    data: { tradingHaltAt?: Date; eventAt?: Date; contestEndAt?: Date }
  ): Promise<MarketEvent | null> {
    const updates: Record<string, any> = {};
    if (data.tradingHaltAt) updates.close_date = data.tradingHaltAt.toISOString();
    if (data.eventAt) updates.settlement_date = data.eventAt.toISOString();

    const { data: result, error } = await supabase
      .from('markets')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error || !result) {
      console.error('Error updating lifecycle:', error);
      return null;
    }

    return transformDbMarket(result as unknown as DbMarket);
  },

  // === SETTLEMENT ===

  // Submit official result
  async submitResult(
    eventId: string, 
    result: 'YES' | 'NO', 
    source: string,
    contestPeriodHours: number = 48
  ): Promise<MarketEvent | null> {
    const { data, error } = await supabase
      .from('markets')
      .update({ 
        status: 'CONTESTED',
        result,
        result_source: source,
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error submitting result:', error);
      return null;
    }

    return transformDbMarket(data as unknown as DbMarket);
  },

  // Execute settlement (payout)
  async executeSettlement(eventId: string): Promise<{
    success: boolean;
    message: string;
    payouts?: Array<{ userId: string; amount: number }>;
  }> {
    const { data: market } = await supabase
      .from('markets')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!market || !market.result) {
      return { success: false, message: 'Mercado não encontrado ou sem resultado.' };
    }

    // Get winning contracts
    const { data: contracts } = await supabase
      .from('user_contracts')
      .select('*')
      .eq('market_id', eventId)
      .eq('position', market.result);

    const payouts: Array<{ userId: string; amount: number }> = [];

    // Process payouts
    for (const contract of contracts || []) {
      const payout = contract.shares * 1; // $1 per winning share

      // Update balance
      const { data: balance } = await supabase
        .from('user_balances')
        .select('balance')
        .eq('user_id', contract.user_id)
        .single();

      await supabase
        .from('user_balances')
        .update({ balance: (balance?.balance || 0) + payout })
        .eq('user_id', contract.user_id);

      // Record transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: contract.user_id,
          market_id: eventId,
          type: 'PAYOUT',
          position: market.result,
          shares: contract.shares,
          total_amount: payout,
        });

      payouts.push({ userId: contract.user_id, amount: payout });
    }

    // Update market status
    await supabase
      .from('markets')
      .update({ status: 'SETTLED' })
      .eq('id', eventId);

    // Record settlement
    await supabase
      .from('market_settlements')
      .insert({
        market_id: eventId,
        result: market.result,
        source: market.result_source || 'ADMIN',
        is_automatic: false,
      });

    // Delete all contracts for this market
    await supabase
      .from('user_contracts')
      .delete()
      .eq('market_id', eventId);

    return { success: true, message: 'Mercado liquidado com sucesso.', payouts };
  },

  // Revert result
  async revertResult(eventId: string): Promise<MarketEvent | null> {
    const { data, error } = await supabase
      .from('markets')
      .update({ 
        status: 'PENDING',
        result: null,
        result_source: null,
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error reverting result:', error);
      return null;
    }

    return transformDbMarket(data as unknown as DbMarket);
  },

  // === CONTESTATIONS ===

  // Get all pending contestations
  async getPendingContestations(): Promise<ContestationWithEvent[]> {
    const { data, error } = await supabase
      .from('contestations')
      .select('*, markets(*)')
      .eq('status', 'PENDING');

    if (error) {
      console.error('Error fetching contestations:', error);
      return [];
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      userId: c.user_id,
      reason: c.reason,
      evidence: c.evidence_url,
      submittedAt: new Date(c.created_at),
      status: c.status as 'OPEN' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED',
      reviewedAt: c.reviewed_at ? new Date(c.reviewed_at) : undefined,
      reviewNotes: c.admin_notes,
      event: c.markets ? transformDbMarket(c.markets as unknown as DbMarket) : undefined,
    })) as ContestationWithEvent[];
  },

  // Review contestation
  async reviewContestation(data: ContestationReviewData): Promise<Contestation | null> {
    const { data: result, error } = await supabase
      .from('contestations')
      .update({
        status: data.status,
        admin_notes: data.reviewNotes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', data.contestationId)
      .select()
      .single();

    if (error || !result) {
      console.error('Error reviewing contestation:', error);
      return null;
    }

    // If accepted, revert the result
    if (data.status === 'ACCEPTED') {
      await this.revertResult(data.eventId);
    }

    return {
      id: result.id,
      userId: result.user_id,
      reason: result.reason,
      evidence: result.evidence_url || undefined,
      submittedAt: new Date(result.created_at),
      status: result.status as 'OPEN' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED',
      reviewedAt: result.reviewed_at ? new Date(result.reviewed_at) : undefined,
      reviewNotes: result.admin_notes || undefined,
    };
  },

  // === LMSR / ODDS ===

  // Adjust liquidity
  async adjustLiquidity(eventId: string, newB: number): Promise<MarketEvent | null> {
    const { data, error } = await supabase
      .from('markets')
      .update({ lmsr_b: newB })
      .eq('id', eventId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error adjusting liquidity:', error);
      return null;
    }

    return transformDbMarket(data as unknown as DbMarket);
  },

  // === METRICS ===

  // Get dashboard metrics
  async getMetrics(): Promise<AdminMetrics> {
    const { data: markets } = await supabase
      .from('markets')
      .select('status, total_volume, settlement_type');

    const { data: contestations } = await supabase
      .from('contestations')
      .select('status')
      .eq('status', 'PENDING');

    const statusCounts = {
      OPEN: 0,
      HALTED: 0,
      PENDING: 0,
      CONTESTED: 0,
      SETTLED: 0,
    };

    let totalVolume = 0;
    let automaticMarkets = 0;

    for (const market of markets || []) {
      statusCounts[market.status as keyof typeof statusCounts]++;
      totalVolume += market.total_volume || 0;
      if (market.settlement_type !== 'MANUAL') {
        automaticMarkets++;
      }
    }

    return {
      totalMarkets: (markets || []).length,
      openMarkets: statusCounts.OPEN,
      haltedMarkets: statusCounts.HALTED,
      pendingMarkets: statusCounts.PENDING,
      contestedMarkets: statusCounts.CONTESTED,
      settledMarkets: statusCounts.SETTLED,
      totalVolume,
      pendingContestations: (contestations || []).length,
      automaticMarkets,
      totalUsers: 0,
    };
  },

  // Get audit log (not implemented in DB yet)
  async getAuditLog(limit: number = 50): Promise<AuditLogEntry[]> {
    return [];
  },

  // Get categories
  async getCategories(): Promise<string[]> {
    const { data } = await supabase
      .from('markets')
      .select('category');

    return [...new Set((data || []).map(m => m.category))];
  },
};
