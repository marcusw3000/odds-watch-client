import { MarketEvent, UserPortfolio, UserContract, Transaction, OddsHistoryPoint, Comment, DbMarket, DbMarketOption, MarketStatus, SettlementType, SettlementConfig, MarketOption } from '@/types/market';
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
import { FeeEngine } from './FeeEngine';

// Transform DB market option to frontend MarketOption
function transformDbMarketOption(dbOption: DbMarketOption): MarketOption {
  return {
    id: dbOption.id,
    label: dbOption.label,
    description: dbOption.description || undefined,
    imageUrl: dbOption.image_url || undefined,
    shares: dbOption.shares,
    currentPrice: Math.round(dbOption.current_price * 100), // Convert decimal to percentage
    displayOrder: dbOption.display_order,
  };
}

// Transform DB market to frontend MarketEvent
function transformDbMarket(
  dbMarket: DbMarket & { image_zoom?: number; image_position_x?: number; image_position_y?: number },
  dbOptions?: DbMarketOption[]
): MarketEvent {
  const lmsr: LMSRState = {
    b: dbMarket.lmsr_b,
    qYes: dbMarket.yes_shares,
    qNo: dbMarket.no_shares,
  };

  const yesPrice = getPriceYes(lmsr);
  const noPrice = getPriceNo(lmsr);

  // Transform options if present
  const options = dbOptions?.map(transformDbMarketOption).sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    id: dbMarket.id,
    title: dbMarket.title,
    category: dbMarket.category,
    description: dbMarket.description || undefined,
    imageUrl: dbMarket.image_url || undefined,
    imageZoom: dbMarket.image_zoom ?? 1,
    imagePosition: {
      x: dbMarket.image_position_x ?? 50,
      y: dbMarket.image_position_y ?? 50,
    },
    status: dbMarket.status as MarketStatus,
    settlementType: dbMarket.settlement_type as SettlementType,
    settlementConfig: dbMarket.settlement_config as SettlementConfig | undefined,
    expiryAt: dbMarket.settlement_date ? new Date(dbMarket.settlement_date) : new Date(),
    tradingHaltAt: dbMarket.close_date ? new Date(dbMarket.close_date) : new Date(),
    eventAt: dbMarket.settlement_date ? new Date(dbMarket.settlement_date) : new Date(),
    limits: { minBuy: 10, maxBuy: 5000 },
    createdAt: new Date(dbMarket.created_at),
    lastUpdatedAt: new Date(dbMarket.updated_at),
    volume: dbMarket.total_volume,
    outcomes: {
      YES: { price: yesPrice, probability: yesPrice },
      NO: { price: noPrice, probability: noPrice },
    },
    lmsr,
    result: dbMarket.result || undefined,
    resultSource: dbMarket.result_source || undefined,
    haltReason: dbMarket.halt_reason || undefined,
    contractUnitCost: dbMarket.contract_unit_cost ?? 100,
    marketType: (dbMarket.market_type as 'BINARY' | 'MULTIPLE') || 'BINARY',
    optionsExclusive: dbMarket.options_exclusive ?? true,
    tags: dbMarket.tags || undefined,
    cardStyle: (dbMarket.card_style as 'default' | 'buttons' | 'simple' | 'minimal') || undefined,
    options,
  };
}

// Mock comments (will be moved to Supabase later)
const mockComments: Record<string, Comment[]> = {};

// Mock markets for development
const mockMarkets: MarketEvent[] = [
  {
    id: 'mock-selic-2026',
    title: 'Taxa SELIC ficará acima de 14% em março de 2026?',
    category: 'Política Monetária',
    description: 'Mercado sobre a decisão do COPOM para a taxa SELIC meta em março de 2026.',
    status: 'OPEN' as MarketStatus,
    settlementType: 'SELIC_META' as SettlementType,
    settlementConfig: { threshold: 14, operator: 'gt' as const },
    expiryAt: new Date('2026-03-20'),
    tradingHaltAt: new Date('2026-03-19T18:00:00'),
    eventAt: new Date('2026-03-20'),
    limits: { minBuy: 10, maxBuy: 5000 },
    createdAt: new Date('2026-01-01'),
    lastUpdatedAt: new Date(),
    volume: 125430,
    outcomes: { YES: { price: 65, probability: 65 }, NO: { price: 35, probability: 35 } },
    lmsr: { b: 100, qYes: 120, qNo: 80 },
    contractUnitCost: 100,
    marketType: 'BINARY',
    optionsExclusive: true,
  },
  {
    id: 'mock-dolar-jan',
    title: 'Dólar fechará acima de R$6,20 em janeiro de 2026?',
    category: 'Câmbio',
    description: 'Previsão para a cotação do dólar PTAX no último dia útil de janeiro.',
    status: 'OPEN' as MarketStatus,
    settlementType: 'PTAX_USD' as SettlementType,
    settlementConfig: { threshold: 6.20, operator: 'gt' as const },
    expiryAt: new Date('2026-01-31'),
    tradingHaltAt: new Date('2026-01-31T12:00:00'),
    eventAt: new Date('2026-01-31'),
    limits: { minBuy: 10, maxBuy: 5000 },
    createdAt: new Date('2026-01-05'),
    lastUpdatedAt: new Date(),
    volume: 89200,
    outcomes: { YES: { price: 72, probability: 72 }, NO: { price: 28, probability: 28 } },
    lmsr: { b: 100, qYes: 150, qNo: 70 },
    contractUnitCost: 100,
    marketType: 'BINARY',
    optionsExclusive: true,
  },
  {
    id: 'mock-euro-jan',
    title: 'Euro fechará acima de R$6,50 em janeiro de 2026?',
    category: 'Câmbio',
    description: 'Previsão para a cotação do euro PTAX no último dia útil de janeiro.',
    status: 'OPEN' as MarketStatus,
    settlementType: 'PTAX_EUR' as SettlementType,
    settlementConfig: { threshold: 6.50, operator: 'gt' as const },
    expiryAt: new Date('2026-01-31'),
    tradingHaltAt: new Date('2026-01-31T12:00:00'),
    eventAt: new Date('2026-01-31'),
    limits: { minBuy: 10, maxBuy: 5000 },
    createdAt: new Date('2026-01-03'),
    lastUpdatedAt: new Date(),
    volume: 45600,
    outcomes: { YES: { price: 58, probability: 58 }, NO: { price: 42, probability: 42 } },
    lmsr: { b: 100, qYes: 110, qNo: 90 },
    contractUnitCost: 100,
    marketType: 'BINARY',
    optionsExclusive: true,
  },
  {
    id: 'mock-ipca-2025',
    title: 'IPCA acumulado de 2025 ficará acima de 5%?',
    category: 'Inflação',
    description: 'Inflação oficial medida pelo IBGE para o ano de 2025.',
    status: 'OPEN' as MarketStatus,
    settlementType: 'IPCA_12M' as SettlementType,
    settlementConfig: { threshold: 5, operator: 'gt' as const },
    expiryAt: new Date('2026-01-10'),
    tradingHaltAt: new Date('2026-01-09T18:00:00'),
    eventAt: new Date('2026-01-10'),
    limits: { minBuy: 10, maxBuy: 5000 },
    createdAt: new Date('2025-12-01'),
    lastUpdatedAt: new Date(),
    volume: 234500,
    outcomes: { YES: { price: 82, probability: 82 }, NO: { price: 18, probability: 18 } },
    lmsr: { b: 100, qYes: 200, qNo: 50 },
    contractUnitCost: 100,
    marketType: 'BINARY',
    optionsExclusive: true,
  },
  {
    id: 'mock-pib-2026',
    title: 'PIB do Brasil crescerá mais de 2% em 2026?',
    category: 'Economia',
    description: 'Crescimento do Produto Interno Bruto brasileiro em 2026.',
    status: 'OPEN' as MarketStatus,
    settlementType: 'PIB' as SettlementType,
    settlementConfig: { threshold: 2, operator: 'gt' as const },
    expiryAt: new Date('2027-03-01'),
    tradingHaltAt: new Date('2027-02-28T18:00:00'),
    eventAt: new Date('2027-03-01'),
    limits: { minBuy: 10, maxBuy: 10000 },
    createdAt: new Date('2026-01-10'),
    lastUpdatedAt: new Date(),
    volume: 312000,
    outcomes: { YES: { price: 45, probability: 45 }, NO: { price: 55, probability: 55 } },
    lmsr: { b: 150, qYes: 90, qNo: 110 },
    contractUnitCost: 100,
    marketType: 'BINARY',
    optionsExclusive: true,
  },
  {
    id: 'mock-recessao-2026',
    title: 'Haverá recessão técnica no Brasil em 2026?',
    category: 'Economia',
    description: 'Recessão técnica = dois trimestres consecutivos de queda no PIB.',
    status: 'OPEN' as MarketStatus,
    settlementType: 'MANUAL' as SettlementType,
    expiryAt: new Date('2027-01-15'),
    tradingHaltAt: new Date('2027-01-14T18:00:00'),
    eventAt: new Date('2027-01-15'),
    limits: { minBuy: 10, maxBuy: 5000 },
    createdAt: new Date('2026-01-08'),
    lastUpdatedAt: new Date(),
    volume: 178900,
    outcomes: { YES: { price: 22, probability: 22 }, NO: { price: 78, probability: 78 } },
    lmsr: { b: 100, qYes: 40, qNo: 160 },
    contractUnitCost: 100,
    marketType: 'BINARY',
    optionsExclusive: true,
  },
  // Mock market with multiple options
  {
    id: 'mock-campeao-brasileiro',
    title: 'Quem será o campeão do Brasileirão 2026?',
    category: 'Esportes',
    description: 'Campeão do Campeonato Brasileiro Série A 2026.',
    status: 'OPEN' as MarketStatus,
    settlementType: 'MANUAL' as SettlementType,
    expiryAt: new Date('2026-12-15'),
    tradingHaltAt: new Date('2026-12-14T18:00:00'),
    eventAt: new Date('2026-12-15'),
    limits: { minBuy: 10, maxBuy: 5000 },
    createdAt: new Date('2026-01-02'),
    lastUpdatedAt: new Date(),
    volume: 450000,
    outcomes: { YES: { price: 50, probability: 50 }, NO: { price: 50, probability: 50 } },
    lmsr: { b: 200, qYes: 100, qNo: 100 },
    contractUnitCost: 100,
    marketType: 'MULTIPLE',
    optionsExclusive: true,
    options: [
      { id: 'opt-flamengo', label: 'Flamengo', shares: 180, currentPrice: 25, displayOrder: 0 },
      { id: 'opt-palmeiras', label: 'Palmeiras', shares: 150, currentPrice: 22, displayOrder: 1 },
      { id: 'opt-saopaulo', label: 'São Paulo', shares: 100, currentPrice: 15, displayOrder: 2 },
      { id: 'opt-corinthians', label: 'Corinthians', shares: 80, currentPrice: 12, displayOrder: 3 },
      { id: 'opt-botafogo', label: 'Botafogo', shares: 70, currentPrice: 10, displayOrder: 4 },
      { id: 'opt-outros', label: 'Outro time', shares: 120, currentPrice: 16, displayOrder: 5 },
    ],
  },
];

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
      return mockMarkets;
    }

    // Return mocks if no data in DB
    if (!data || data.length === 0) {
      return mockMarkets;
    }

    // Fetch options for MULTIPLE markets
    const multipleMarketIds = data
      .filter(m => m.market_type === 'MULTIPLE')
      .map(m => m.id);

    let optionsMap: Record<string, DbMarketOption[]> = {};
    
    if (multipleMarketIds.length > 0) {
      const { data: optionsData } = await supabase
        .from('market_options')
        .select('*')
        .in('market_id', multipleMarketIds)
        .order('display_order', { ascending: true });

      if (optionsData) {
        optionsMap = optionsData.reduce((acc, opt) => {
          const marketId = opt.market_id;
          if (!acc[marketId]) acc[marketId] = [];
          acc[marketId].push(opt as unknown as DbMarketOption);
          return acc;
        }, {} as Record<string, DbMarketOption[]>);
      }
    }

    return data.map(m => transformDbMarket(
      m as unknown as DbMarket,
      optionsMap[m.id]
    ));
  },

  // Busca evento específico por ID
  async getEventById(id: string): Promise<MarketEvent | null> {
    // Check if it's a mock ID first
    const mockMarket = mockMarkets.find(m => m.id === id);
    if (mockMarket) {
      return mockMarket;
    }

    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching market:', error);
      return null;
    }

    // Fetch options if it's a MULTIPLE market
    let options: DbMarketOption[] | undefined;
    if (data.market_type === 'MULTIPLE') {
      const { data: optionsData } = await supabase
        .from('market_options')
        .select('*')
        .eq('market_id', id)
        .order('display_order', { ascending: true });

      if (optionsData) {
        options = optionsData as unknown as DbMarketOption[];
      }
    }

    return transformDbMarket(data as unknown as DbMarket, options);
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
    
    // Mock contracts for demo purposes
    const mockContracts: UserContract[] = [
      {
        id: 'mock-contract-1',
        eventId: 'mock-selic-2026',
        eventTitle: 'Taxa SELIC ficará acima de 14% em março de 2026?',
        outcome: 'YES',
        quantity: 10,
        priceAtPurchase: 65,
        purchasedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        status: 'ACTIVE',
      },
      {
        id: 'mock-contract-2',
        eventId: 'mock-dolar-jan',
        eventTitle: 'Dólar fechará acima de R$6,20 em janeiro de 2026?',
        outcome: 'NO',
        quantity: 5,
        priceAtPurchase: 28,
        purchasedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        status: 'ACTIVE',
      },
      {
        id: 'mock-contract-3',
        eventId: 'mock-ipca-2025',
        eventTitle: 'IPCA acumulado de 2025 ficará acima de 5%?',
        outcome: 'YES',
        quantity: 15,
        priceAtPurchase: 82,
        purchasedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        status: 'ACTIVE',
      },
      {
        id: 'mock-contract-4',
        eventId: 'mock-settled-1',
        eventTitle: 'Taxa SELIC subiu em dezembro de 2025?',
        outcome: 'YES',
        quantity: 8,
        priceAtPurchase: 70,
        purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        status: 'WON',
        payout: 8, // R$1 per contract won
      },
      {
        id: 'mock-contract-5',
        eventId: 'mock-settled-2',
        eventTitle: 'Dólar fechou abaixo de R$5,50 em novembro?',
        outcome: 'YES',
        quantity: 12,
        priceAtPurchase: 45,
        purchasedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        status: 'LOST',
      },
    ];

    const mockTransactions: Transaction[] = [
      {
        id: 'mock-tx-1',
        type: 'BUY',
        amount: 6.50,
        eventTitle: 'Taxa SELIC ficará acima de 14% em março de 2026?',
        outcome: 'YES',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'mock-tx-2',
        type: 'BUY',
        amount: 1.40,
        eventTitle: 'Dólar fechará acima de R$6,20 em janeiro de 2026?',
        outcome: 'NO',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'mock-tx-3',
        type: 'DEPOSIT',
        amount: 500,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'mock-tx-4',
        type: 'PAYOUT',
        amount: 8,
        eventTitle: 'Taxa SELIC subiu em dezembro de 2025?',
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      },
    ];

    if (!user) {
      // Return mock data for non-logged users to see the UI
      return { 
        balance: 485.60, 
        totalProfit: 23.45, 
        contracts: mockContracts, 
        transactions: mockTransactions 
      };
    }

    // Get balance from wallets table
    // @ts-ignore - new columns exist after migration, types will be regenerated
    const walletResult = await supabase
      .from('wallets')
      .select('balance_available, total_deposited, total_withdrawn')
      .eq('user_id', user.id)
      .maybeSingle();

    if (walletResult.error) {
      console.error('Error fetching wallet:', walletResult.error);
      throw walletResult.error;
    }

    const balanceData = walletResult.data as
      | { balance_available: number; total_deposited: number; total_withdrawn: number }
      | null;

    // Get contracts
    const contractsResult = await supabase
      .from('user_contracts')
      .select('*, markets(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (contractsResult.error) {
      console.error('Error fetching contracts:', contractsResult.error);
      throw contractsResult.error;
    }

    // Get transactions
    const transactionsResult = await supabase
      .from('transactions')
      .select('*, markets(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (transactionsResult.error) {
      console.error('Error fetching transactions:', transactionsResult.error);
      throw transactionsResult.error;
    }

    const contractsData = contractsResult.data;
    const transactionsData = transactionsResult.data;

    let contracts: UserContract[] = (contractsData || []).map((c: any) => ({
      id: c.id,
      eventId: c.market_id,
      eventTitle: c.markets?.title || 'Unknown',
      outcome: c.position as 'YES' | 'NO',
      quantity: c.shares,
      priceAtPurchase: c.average_price * 100,
      purchasedAt: new Date(c.created_at),
      status: 'ACTIVE' as const,
    }));

    let transactions: Transaction[] = (transactionsData || []).map((t: any) => ({
      id: t.id,
      type: t.type as 'BUY' | 'SELL' | 'PAYOUT' | 'DEPOSIT',
      amount: t.total_amount,
      eventTitle: t.markets?.title,
      outcome: t.position as 'YES' | 'NO' | undefined,
      createdAt: new Date(t.created_at),
    }));

    // Never use demo fallbacks for authenticated users.
    // If the user has no wallet row yet, show 0 and empty lists.
    const balance = balanceData?.balance_available ?? 0;
    const totalDeposited = balanceData?.total_deposited ?? 0;

    return {
      balance,
      totalProfit: balance - totalDeposited,
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

  // Compra de contrato usando edge function (server-side)
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

    // Check if this is a mock market (non-UUID ID) - handle locally for demo purposes
    const isMockMarket = eventId.startsWith('mock-');
    
    if (isMockMarket) {
      // For mock markets, use client-side logic (demo only)
      return this.purchaseContractMock(eventId, outcome, shares, maxCost, market, user.id);
    }

    // For real markets, use server-side edge function
    try {
      const { data, error } = await supabase.functions.invoke('execute-trade', {
        body: { marketId: eventId, outcome, shares, maxCost }
      });

      if (error) {
        console.error('Trade error:', error);
        return { success: false, message: error.message || 'Erro ao executar compra.' };
      }

      if (!data.success) {
        return { 
          success: false, 
          message: data.message || 'Erro ao executar compra.',
          quote: data.quote,
        };
      }

      return {
        success: true,
        message: data.message,
        contract: data.contract,
        quote: data.quote,
      };
    } catch (err) {
      console.error('Trade error:', err);
      return { success: false, message: 'Erro ao processar compra.' };
    }
  },

  // Mock market purchase (for demo purposes only - no real DB changes)
  async purchaseContractMock(
    eventId: string,
    outcome: 'YES' | 'NO',
    shares: number,
    maxCost: number,
    market: MarketEvent,
    userId: string
  ): Promise<{ success: boolean; message: string; contract?: UserContract; quote?: TradeQuote }> {
    const quote = getQuote(market.lmsr, outcome, shares);
    
    if (quote.cost > maxCost * 1.05) {
      return { 
        success: false, 
        message: 'O preço mudou significativamente. Por favor, atualize e tente novamente.',
        quote,
      };
    }

    // Get user balance from wallets (cast to bypass type issues during migration)
    const { data: balanceData } = await supabase
      .from('wallets')
      .select('balance_available')
      .eq('user_id', userId)
      .maybeSingle() as { data: { balance_available: number } | null; error: unknown };

    if (!balanceData || balanceData.balance_available < quote.cost) {
      return { success: false, message: 'Saldo insuficiente.', quote };
    }

    // No fee - just check balance against cost
    if (balanceData.balance_available < quote.cost) {
      return { success: false, message: 'Saldo insuficiente.', quote };
    }

    // Note: For mock markets, we can't update balance due to RLS restrictions
    // This is expected - mock markets are for UI demonstration only

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
      message: 'Compra simulada! (mercado demo)',
      contract: newContract,
      quote,
    };
  },

  // Venda de contrato usando edge function (server-side)
  async sellContract(
    contractId: string,
    minValue: number
  ): Promise<{ success: boolean; message: string; saleValue?: number; quote?: TradeQuote }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Usuário não autenticado.' };
    }

    // Use server-side edge function for secure trade execution
    try {
      const { data, error } = await supabase.functions.invoke('execute-sell', {
        body: { contractId, minValue }
      });

      if (error) {
        console.error('Sell error:', error);
        return { success: false, message: error.message || 'Erro ao executar venda.' };
      }

      if (!data.success) {
        return { 
          success: false, 
          message: data.message || 'Erro ao executar venda.',
          quote: data.quote,
        };
      }

      return {
        success: true,
        message: data.message,
        saleValue: data.saleValue,
        quote: data.quote,
      };
    } catch (err) {
      console.error('Sell error:', err);
      return { success: false, message: 'Erro ao processar venda.' };
    }
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
