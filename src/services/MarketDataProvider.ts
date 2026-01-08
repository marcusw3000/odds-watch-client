import { MarketEvent, UserPortfolio, UserContract, Transaction, OddsHistoryPoint, Comment, DbMarket, MarketStatus, SettlementType, SettlementConfig } from '@/types/market';
import { supabase } from '@/integrations/supabase/client';
import { 
  getPriceYes, 
  getPriceNo, 
  getQuote, 
  getSellQuote, 
  executeBuy, 
  executeSell,
  initializeLMSR,
  TradeQuote,
  LMSRState,
} from './LMSRCalculator';

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

// Mock comments (will be moved to Supabase later)
const mockComments: Record<string, Comment[]> = {};

// Provider público - cliente só pode LER dados
export const MarketDataProvider = {
  // Busca todos os eventos
  async getEvents(): Promise<MarketEvent[]> {
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

  // Busca evento específico por ID
  async getEventById(id: string): Promise<MarketEvent | null> {
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

  // Busca odds atualizadas (simula refresh)
  async refreshOdds(eventId: string): Promise<MarketEvent | null> {
    return this.getEventById(eventId);
  },

  // Busca eventos por categoria
  async getEventsByCategory(category: string): Promise<MarketEvent[]> {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .ilike('category', category)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching markets by category:', error);
      return [];
    }

    return (data || []).map(m => transformDbMarket(m as unknown as DbMarket));
  },

  // Busca categorias disponíveis
  async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('markets')
      .select('category');

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    const categories = [...new Set((data || []).map(m => m.category))];
    return categories;
  },

  // Busca histórico de odds (mock for now)
  async getOddsHistory(eventId: string): Promise<OddsHistoryPoint[]> {
    const market = await this.getEventById(eventId);
    if (!market) return [];

    // Generate mock history based on current price
    const history: OddsHistoryPoint[] = [];
    const now = new Date();
    const currentYes = market.outcomes.YES.price;
    
    let historicalYes = currentYes + (Math.random() - 0.5) * 30;
    historicalYes = Math.max(10, Math.min(90, historicalYes));
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const progress = 1 - (i / 30);
      const targetYes = historicalYes + (currentYes - historicalYes) * progress;
      const noise = (Math.random() - 0.5) * 5;
      const yesPrice = Math.max(5, Math.min(95, Math.round(targetYes + noise)));
      
      history.push({
        timestamp: date,
        yesPrice,
        noPrice: 100 - yesPrice,
      });
    }

    history[history.length - 1] = {
      timestamp: now,
      yesPrice: currentYes,
      noPrice: 100 - currentYes,
    };

    return history;
  },

  // Busca comentários do evento
  async getEventComments(eventId: string): Promise<Comment[]> {
    return mockComments[eventId] || [];
  },

  // Busca mercados para autocomplete
  async searchEvents(query: string): Promise<MarketEvent[]> {
    if (!query.trim()) return [];
    
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .or(`title.ilike.%${query}%,category.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching markets:', error);
      return [];
    }

    return (data || []).map(m => transformDbMarket(m as unknown as DbMarket));
  },

  // Busca portfolio do usuário
  async getUserPortfolio(): Promise<UserPortfolio> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { balance: 0, totalProfit: 0, contracts: [], transactions: [] };
    }

    // Get balance
    const { data: balanceData } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get contracts
    const { data: contractsData } = await supabase
      .from('user_contracts')
      .select('*, markets(title)')
      .eq('user_id', user.id);

    // Get transactions
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*, markets(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const contracts: UserContract[] = (contractsData || []).map((c: any) => ({
      id: c.id,
      eventId: c.market_id,
      eventTitle: c.markets?.title || 'Unknown',
      outcome: c.position as 'YES' | 'NO',
      quantity: c.shares,
      priceAtPurchase: c.average_price * 100,
      purchasedAt: new Date(c.created_at),
      status: 'ACTIVE' as const,
    }));

    const transactions: Transaction[] = (transactionsData || []).map((t: any) => ({
      id: t.id,
      type: t.type as 'BUY' | 'SELL' | 'PAYOUT' | 'DEPOSIT',
      amount: t.total_amount,
      eventTitle: t.markets?.title,
      outcome: t.position as 'YES' | 'NO' | undefined,
      createdAt: new Date(t.created_at),
    }));

    return {
      balance: balanceData?.balance || 0,
      totalProfit: (balanceData?.balance || 0) - (balanceData?.total_deposited || 0),
      contracts,
      transactions,
    };
  },

  // Get quote for buying shares (LMSR-based)
  async getQuote(
    eventId: string,
    outcome: 'YES' | 'NO',
    shares: number
  ): Promise<TradeQuote | null> {
    const market = await this.getEventById(eventId);
    if (!market) return null;
    
    return getQuote(market.lmsr, outcome, shares);
  },

  // Get quote for selling shares (LMSR-based)
  async getSellQuote(
    eventId: string,
    outcome: 'YES' | 'NO',
    shares: number
  ): Promise<TradeQuote | null> {
    const market = await this.getEventById(eventId);
    if (!market) return null;
    
    return getSellQuote(market.lmsr, outcome, shares);
  },

  // Compra de contrato usando LMSR
  async purchaseContract(
    eventId: string,
    outcome: 'YES' | 'NO',
    shares: number,
    maxCost: number
  ): Promise<{ success: boolean; message: string; contract?: UserContract; quote?: TradeQuote }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Usuário não autenticado.' };
    }

    const market = await this.getEventById(eventId);
    if (!market) {
      return { success: false, message: 'Mercado não encontrado.' };
    }
    
    if (market.status !== 'OPEN') {
      return { success: false, message: 'Este mercado não está aberto para negociação.' };
    }
    
    const quote = getQuote(market.lmsr, outcome, shares);
    
    if (quote.cost > maxCost * 1.05) {
      return { 
        success: false, 
        message: 'O preço mudou significativamente. Por favor, atualize e tente novamente.',
        quote,
      };
    }

    // Get user balance
    const { data: balanceData } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!balanceData || balanceData.balance < quote.cost) {
      return { success: false, message: 'Saldo insuficiente.', quote };
    }

    // Execute trade - update market LMSR state
    const newState = executeBuy(market.lmsr, outcome, shares);
    const newYesPrice = getPriceYes(newState);
    const newNoPrice = getPriceNo(newState);

    // Update market in database
    const { error: marketError } = await supabase
      .from('markets')
      .update({
        yes_shares: newState.qYes,
        no_shares: newState.qNo,
        current_yes_price: newYesPrice / 100,
        current_no_price: newNoPrice / 100,
        total_volume: market.volume + quote.cost,
      })
      .eq('id', eventId);

    if (marketError) {
      console.error('Error updating market:', marketError);
      return { success: false, message: 'Erro ao processar compra.' };
    }

    // Deduct balance
    const { error: balanceError } = await supabase
      .from('user_balances')
      .update({ balance: balanceData.balance - quote.cost })
      .eq('user_id', user.id);

    if (balanceError) {
      console.error('Error updating balance:', balanceError);
    }

    // Create or update contract
    const { data: existingContract } = await supabase
      .from('user_contracts')
      .select('*')
      .eq('user_id', user.id)
      .eq('market_id', eventId)
      .eq('position', outcome)
      .maybeSingle();

    if (existingContract) {
      // Update existing contract
      const newShares = existingContract.shares + shares;
      const newTotalInvested = existingContract.total_invested + quote.cost;
      const newAvgPrice = newTotalInvested / newShares;

      await supabase
        .from('user_contracts')
        .update({
          shares: newShares,
          total_invested: newTotalInvested,
          average_price: newAvgPrice,
        })
        .eq('id', existingContract.id);
    } else {
      // Create new contract
      await supabase
        .from('user_contracts')
        .insert({
          user_id: user.id,
          market_id: eventId,
          position: outcome,
          shares,
          average_price: quote.avgPrice / 100,
          total_invested: quote.cost,
        });
    }

    // Record transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        market_id: eventId,
        type: 'BUY',
        position: outcome,
        shares,
        price_per_share: quote.avgPrice / 100,
        total_amount: -quote.cost,
      });

    const newContract: UserContract = {
      id: `ctr-${Date.now()}`,
      eventId,
      eventTitle: market.title,
      outcome,
      quantity: shares,
      priceAtPurchase: quote.avgPrice,
      purchasedAt: new Date(),
      status: 'ACTIVE',
    };
    
    return {
      success: true,
      message: 'Compra realizada com sucesso!',
      contract: newContract,
      quote,
    };
  },

  // Venda de contrato
  async sellContract(
    contractId: string,
    minValue: number
  ): Promise<{ success: boolean; message: string; saleValue?: number; quote?: TradeQuote }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Usuário não autenticado.' };
    }

    // Get contract
    const { data: contract } = await supabase
      .from('user_contracts')
      .select('*, markets(title, yes_shares, no_shares, lmsr_b, status)')
      .eq('id', contractId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!contract) {
      return { success: false, message: 'Contrato não encontrado.' };
    }

    const market = contract.markets as any;
    if (market.status !== 'OPEN') {
      return { success: false, message: 'Este mercado não está aberto para negociação.' };
    }

    const lmsr: LMSRState = {
      b: market.lmsr_b,
      qYes: market.yes_shares,
      qNo: market.no_shares,
    };

    const quote = getSellQuote(lmsr, contract.position as 'YES' | 'NO', contract.shares);
    
    if (quote.cost < minValue * 0.95) {
      return { 
        success: false, 
        message: 'O preço mudou significativamente. Por favor, atualize e tente novamente.',
        quote,
      };
    }

    // Execute sell
    const newState = executeSell(lmsr, contract.position as 'YES' | 'NO', contract.shares);
    const newYesPrice = getPriceYes(newState);
    const newNoPrice = getPriceNo(newState);

    // Update market
    await supabase
      .from('markets')
      .update({
        yes_shares: newState.qYes,
        no_shares: newState.qNo,
        current_yes_price: newYesPrice / 100,
        current_no_price: newNoPrice / 100,
      })
      .eq('id', contract.market_id);

    // Add balance
    const { data: balanceData } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    await supabase
      .from('user_balances')
      .update({ balance: (balanceData?.balance || 0) + quote.cost })
      .eq('user_id', user.id);

    // Delete contract
    await supabase
      .from('user_contracts')
      .delete()
      .eq('id', contractId);

    // Record transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        market_id: contract.market_id,
        type: 'SELL',
        position: contract.position,
        shares: contract.shares,
        price_per_share: quote.avgPrice / 100,
        total_amount: quote.cost,
      });

    return {
      success: true,
      message: 'Venda realizada com sucesso!',
      saleValue: quote.cost,
      quote,
    };
  },

  // Get current price for contract
  async getCurrentPriceForContract(contract: UserContract): Promise<number> {
    const market = await this.getEventById(contract.eventId);
    if (!market) return contract.priceAtPurchase;

    return contract.outcome === 'YES' 
      ? market.outcomes.YES.price 
      : market.outcomes.NO.price;
  },
};
