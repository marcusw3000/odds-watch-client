import { MarketEvent, UserPortfolio, UserContract, Transaction, OddsHistoryPoint, Comment, LMSRState } from '@/types/market';
import { 
  getPriceYes, 
  getPriceNo, 
  getQuote, 
  getSellQuote, 
  executeBuy, 
  executeSell,
  initializeLMSR,
  TradeQuote,
} from './LMSRCalculator';

// Helper to create initial LMSR state with target price
function createLMSRState(initialYesPrice: number, liquidity: number = 100): LMSRState {
  return initializeLMSR(initialYesPrice, liquidity);
}

// Store LMSR states separately to allow mutations
const lmsrStates: Record<string, LMSRState> = {
  'evt-001': createLMSRState(65, 100),
  'evt-002': createLMSRState(50, 100),
  'evt-003': createLMSRState(35, 80),
  'evt-004': createLMSRState(72, 120),
  'evt-005': createLMSRState(42, 150),
};

// Get current prices from LMSR state
function getOutcomesFromLMSR(eventId: string): { YES: { price: number; probability: number }; NO: { price: number; probability: number } } {
  const state = lmsrStates[eventId];
  if (!state) {
    return {
      YES: { price: 50, probability: 50 },
      NO: { price: 50, probability: 50 },
    };
  }
  
  const yesPrice = getPriceYes(state);
  const noPrice = getPriceNo(state);
  
  return {
    YES: { price: yesPrice, probability: yesPrice },
    NO: { price: noPrice, probability: noPrice },
  };
}

// Mock data - simula dados que virão de uma API/dashboard admin
const mockEventsBase: Omit<MarketEvent, 'outcomes' | 'lmsr'>[] = [
  {
    id: 'evt-001',
    title: 'O Banco Central vai reduzir a taxa Selic até dezembro?',
    category: 'Economia',
    expiryAt: new Date('2024-12-31T23:59:59'),
    status: 'OPEN',
    limits: { minBuy: 10, maxBuy: 5000 },
    lastUpdatedAt: new Date(),
    volume: 125430,
    description: 'Este mercado será liquidado com base na decisão oficial do COPOM sobre a taxa Selic.',
    settlementRules: [
      'Fonte oficial: Comunicado do COPOM publicado no site do Banco Central',
      'Considera-se redução qualquer corte de 0,25 p.p. ou mais na taxa Selic',
      'Data limite: última reunião do COPOM de 2024 (10-11 de dezembro)',
      'Em caso de reunião extraordinária, esta será considerada na liquidação',
    ],
  },
  {
    id: 'evt-002',
    title: 'O dólar ficará abaixo de R$4,80 até o fim do ano?',
    category: 'Câmbio',
    expiryAt: new Date('2024-12-31T23:59:59'),
    status: 'OPEN',
    limits: { minBuy: 10, maxBuy: 10000 },
    lastUpdatedAt: new Date(),
    volume: 89750,
    description: 'Baseado na cotação oficial do dólar comercial PTAX no último dia útil do ano.',
    settlementRules: [
      'Fonte oficial: Taxa PTAX de venda divulgada pelo Banco Central',
      'Considera-se a cotação de fechamento do último dia útil de 2024',
      'Valor de referência: R$4,80 (exatamente)',
      'Se igual a R$4,80, o mercado será liquidado como NÃO',
    ],
  },
  {
    id: 'evt-003',
    title: 'O Brasil ganhará mais de 10 medalhas de ouro nas próximas Olimpíadas?',
    category: 'Esportes',
    expiryAt: new Date('2024-08-11T23:59:59'),
    status: 'OPEN',
    limits: { minBuy: 5, maxBuy: 2000 },
    lastUpdatedAt: new Date(),
    volume: 45200,
    description: 'Contabiliza medalhas de ouro oficiais reconhecidas pelo COB.',
    settlementRules: [
      'Fonte oficial: Quadro de medalhas do Comitê Olímpico Internacional (COI)',
      'Considera-se apenas medalhas de ouro (não prata ou bronze)',
      'Número mínimo para SIM: 11 medalhas de ouro ou mais',
      'Medalhas conquistadas em equipe contam como uma única medalha',
    ],
  },
  {
    id: 'evt-004',
    title: 'A inflação IPCA ficará abaixo de 5% em 2024?',
    category: 'Economia',
    expiryAt: new Date('2025-01-15T23:59:59'),
    status: 'OPEN',
    limits: { minBuy: 10, maxBuy: 8000 },
    lastUpdatedAt: new Date(),
    volume: 203100,
    description: 'Baseado no IPCA acumulado de 12 meses divulgado pelo IBGE.',
    settlementRules: [
      'Fonte oficial: IPCA divulgado pelo IBGE',
      'Considera-se o acumulado de janeiro a dezembro de 2024',
      'Valor de referência: 5,00% (exatamente)',
      'Liquidação ocorre após divulgação do IPCA de dezembro (meados de janeiro 2025)',
    ],
  },
  {
    id: 'evt-005',
    title: 'O Ibovespa fechará acima de 140.000 pontos em 2024?',
    category: 'Mercado',
    expiryAt: new Date('2024-12-30T18:00:00'),
    status: 'OPEN',
    limits: { minBuy: 10, maxBuy: 15000 },
    lastUpdatedAt: new Date(),
    volume: 312500,
    description: 'Baseado no fechamento oficial do índice Ibovespa na B3.',
    settlementRules: [
      'Fonte oficial: Ibovespa divulgado pela B3',
      'Considera-se o fechamento do último pregão de 2024',
      'Valor de referência: 140.000 pontos (exatamente)',
      'Se igual a 140.000, o mercado será liquidado como NÃO',
    ],
  },
];

// Build full events with dynamic LMSR-based outcomes
function buildMarketEvents(): MarketEvent[] {
  return mockEventsBase.map(base => ({
    ...base,
    outcomes: getOutcomesFromLMSR(base.id),
    lmsr: lmsrStates[base.id] || createLMSRState(50),
    lastUpdatedAt: new Date(),
  }));
}

// Mock histórico de odds (últimos 30 dias) - now simulates LMSR trades
function generateOddsHistory(eventId: string): OddsHistoryPoint[] {
  const state = lmsrStates[eventId];
  if (!state) return [];

  const history: OddsHistoryPoint[] = [];
  const now = new Date();
  
  // Simulate historical state evolution
  let simState = { ...state };
  const currentYes = getPriceYes(simState);
  
  // Start from a random point and evolve to current
  let historicalYes = currentYes + (Math.random() - 0.5) * 30;
  historicalYes = Math.max(10, Math.min(90, historicalYes));
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Gradually move towards current price
    const progress = 1 - (i / 30);
    const targetYes = historicalYes + (currentYes - historicalYes) * progress;
    
    // Add some noise
    const noise = (Math.random() - 0.5) * 5;
    const yesPrice = Math.max(5, Math.min(95, Math.round(targetYes + noise)));
    
    history.push({
      timestamp: date,
      yesPrice,
      noPrice: 100 - yesPrice,
    });
  }

  // Last point is exactly current price
  history[history.length - 1] = {
    timestamp: now,
    yesPrice: getPriceYes(state),
    noPrice: getPriceNo(state),
  };

  return history;
}

// Mock comentários
const mockComments: Record<string, Comment[]> = {
  'evt-001': [
    { id: 'c1', author: 'MarketAnalyst', content: 'COPOM deve manter postura cautelosa. Inflação ainda preocupa.', createdAt: new Date('2024-11-20'), likes: 24 },
    { id: 'c2', author: 'EconBR', content: 'Mercado precificando corte de 0,25 p.p. na última reunião.', createdAt: new Date('2024-11-22'), likes: 18 },
    { id: 'c3', author: 'TraderPro', content: 'Atenção para dados do IPCA de novembro antes de entrar.', createdAt: new Date('2024-11-25'), likes: 12 },
  ],
  'evt-002': [
    { id: 'c4', author: 'FXTrader', content: 'Dólar sob pressão com commodities em alta. Chance real de ficar abaixo de 4,80.', createdAt: new Date('2024-11-21'), likes: 31 },
    { id: 'c5', author: 'MacroView', content: 'Cenário externo vai definir. Fed mais dovish ajuda Real.', createdAt: new Date('2024-11-23'), likes: 15 },
  ],
  'evt-004': [
    { id: 'c6', author: 'InflationWatch', content: 'Núcleos de inflação melhorando. Acho que fica abaixo de 5%.', createdAt: new Date('2024-11-19'), likes: 42 },
  ],
};

let mockUserPortfolio: UserPortfolio = {
  balance: 2500.00,
  totalProfit: 340.50,
  contracts: [
    {
      id: 'ctr-001',
      eventId: 'evt-001',
      eventTitle: 'O Banco Central vai reduzir a taxa Selic até dezembro?',
      outcome: 'YES',
      quantity: 50,
      priceAtPurchase: 62,
      purchasedAt: new Date('2024-01-15T10:30:00'),
      status: 'ACTIVE',
    },
    {
      id: 'ctr-002',
      eventId: 'evt-004',
      eventTitle: 'A inflação IPCA ficará abaixo de 5% em 2024?',
      outcome: 'NO',
      quantity: 30,
      priceAtPurchase: 32,
      purchasedAt: new Date('2024-02-20T14:45:00'),
      status: 'ACTIVE',
    },
  ],
  transactions: [
    {
      id: 'tx-001',
      type: 'DEPOSIT',
      amount: 1000,
      createdAt: new Date('2024-01-10T09:00:00'),
    },
    {
      id: 'tx-002',
      type: 'BUY',
      amount: -310,
      eventTitle: 'O Banco Central vai reduzir a taxa Selic até dezembro?',
      outcome: 'YES',
      createdAt: new Date('2024-01-15T10:30:00'),
    },
    {
      id: 'tx-003',
      type: 'DEPOSIT',
      amount: 2000,
      createdAt: new Date('2024-02-01T11:00:00'),
    },
    {
      id: 'tx-004',
      type: 'BUY',
      amount: -96,
      eventTitle: 'A inflação IPCA ficará abaixo de 5% em 2024?',
      outcome: 'NO',
      createdAt: new Date('2024-02-20T14:45:00'),
    },
    {
      id: 'tx-005',
      type: 'PAYOUT',
      amount: 250,
      eventTitle: 'PIB vai crescer mais de 2% no 1º trimestre?',
      outcome: 'YES',
      createdAt: new Date('2024-03-01T12:00:00'),
    },
  ],
};

// Provider público - cliente só pode LER dados
export const MarketDataProvider = {
  // Busca todos os eventos
  async getEvents(): Promise<MarketEvent[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return buildMarketEvents();
  },

  // Busca evento específico por ID
  async getEventById(id: string): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const events = buildMarketEvents();
    return events.find(e => e.id === id) || null;
  },

  // Busca odds atualizadas (simula refresh)
  async refreshOdds(eventId: string): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 150));
    const events = buildMarketEvents();
    return events.find(e => e.id === eventId) || null;
  },

  // Busca eventos por categoria
  async getEventsByCategory(category: string): Promise<MarketEvent[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return buildMarketEvents()
      .filter(e => e.category.toLowerCase() === category.toLowerCase());
  },

  // Busca categorias disponíveis
  async getCategories(): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    const categories = [...new Set(mockEventsBase.map(e => e.category))];
    return categories;
  },

  // Busca histórico de odds
  async getOddsHistory(eventId: string): Promise<OddsHistoryPoint[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return generateOddsHistory(eventId);
  },

  // Busca comentários do evento
  async getEventComments(eventId: string): Promise<Comment[]> {
    await new Promise(resolve => setTimeout(resolve, 150));
    return mockComments[eventId] || [];
  },

  // Busca mercados para autocomplete
  async searchEvents(query: string): Promise<MarketEvent[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    return buildMarketEvents().filter(e => 
      e.title.toLowerCase().includes(lowerQuery) ||
      e.category.toLowerCase().includes(lowerQuery)
    );
  },

  // Busca portfolio do usuário
  async getUserPortfolio(): Promise<UserPortfolio> {
    await new Promise(resolve => setTimeout(resolve, 250));
    return { ...mockUserPortfolio };
  },

  // Get quote for buying shares (LMSR-based)
  async getQuote(
    eventId: string,
    outcome: 'YES' | 'NO',
    shares: number
  ): Promise<TradeQuote | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const state = lmsrStates[eventId];
    if (!state) return null;
    
    return getQuote(state, outcome, shares);
  },

  // Get quote for selling shares (LMSR-based)
  async getSellQuote(
    eventId: string,
    outcome: 'YES' | 'NO',
    shares: number
  ): Promise<TradeQuote | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const state = lmsrStates[eventId];
    if (!state) return null;
    
    return getSellQuote(state, outcome, shares);
  },

  // Compra de contrato usando LMSR
  async purchaseContract(
    eventId: string,
    outcome: 'YES' | 'NO',
    shares: number,
    maxCost: number // Maximum the user is willing to pay
  ): Promise<{ success: boolean; message: string; contract?: UserContract; quote?: TradeQuote }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const state = lmsrStates[eventId];
    if (!state) {
      return { success: false, message: 'Evento não encontrado.' };
    }
    
    const event = buildMarketEvents().find(e => e.id === eventId);
    if (!event) {
      return { success: false, message: 'Evento não encontrado.' };
    }
    
    if (event.status !== 'OPEN') {
      return { success: false, message: 'Este mercado não está aberto para negociação.' };
    }
    
    // Get fresh quote
    const quote = getQuote(state, outcome, shares);
    
    // Check if cost is within tolerance (5% slippage protection)
    if (quote.cost > maxCost * 1.05) {
      return { 
        success: false, 
        message: 'O preço mudou significativamente. Por favor, atualize e tente novamente.',
        quote,
      };
    }
    
    if (quote.cost > mockUserPortfolio.balance) {
      return { success: false, message: 'Saldo insuficiente.', quote };
    }
    
    // Execute the trade - update LMSR state
    lmsrStates[eventId] = executeBuy(state, outcome, shares);
    
    const newContract: UserContract = {
      id: `ctr-${Date.now()}`,
      eventId,
      eventTitle: event.title,
      outcome,
      quantity: shares,
      priceAtPurchase: quote.avgPrice,
      purchasedAt: new Date(),
      status: 'ACTIVE',
    };

    // Update portfolio
    mockUserPortfolio.balance -= quote.cost;
    mockUserPortfolio.contracts.push(newContract);
    mockUserPortfolio.transactions.push({
      id: `tx-${Date.now()}`,
      type: 'BUY',
      amount: -quote.cost,
      eventTitle: event.title,
      outcome,
      createdAt: new Date(),
    });
    
    return {
      success: true,
      message: 'Compra realizada com sucesso!',
      contract: newContract,
      quote,
    };
  },

  // Venda de contrato usando LMSR
  async sellContract(
    contractId: string,
    minValue: number // Minimum the user is willing to accept
  ): Promise<{ success: boolean; message: string; saleValue?: number; quote?: TradeQuote }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const contractIndex = mockUserPortfolio.contracts.findIndex(c => c.id === contractId);
    if (contractIndex === -1) {
      return { success: false, message: 'Contrato não encontrado.' };
    }

    const contract = mockUserPortfolio.contracts[contractIndex];
    if (contract.status !== 'ACTIVE') {
      return { success: false, message: 'Este contrato não está ativo.' };
    }

    const state = lmsrStates[contract.eventId];
    if (!state) {
      return { success: false, message: 'Evento não encontrado.' };
    }

    // Get fresh quote
    const quote = getSellQuote(state, contract.outcome, contract.quantity);
    
    // Check if value is within tolerance (5% slippage protection)
    if (quote.cost < minValue * 0.95) {
      return { 
        success: false, 
        message: 'O preço mudou significativamente. Por favor, atualize e tente novamente.',
        quote,
      };
    }

    // Execute the trade - update LMSR state
    lmsrStates[contract.eventId] = executeSell(state, contract.outcome, contract.quantity);

    const saleValue = quote.cost;

    // Update portfolio
    mockUserPortfolio.balance += saleValue;
    mockUserPortfolio.contracts.splice(contractIndex, 1);
    mockUserPortfolio.transactions.push({
      id: `tx-${Date.now()}`,
      type: 'SELL',
      amount: saleValue,
      eventTitle: contract.eventTitle,
      outcome: contract.outcome,
      createdAt: new Date(),
    });

    return {
      success: true,
      message: 'Contrato vendido com sucesso!',
      saleValue,
      quote,
    };
  },

  // Busca preço atual de mercado para um contrato
  async getCurrentPriceForContract(contract: UserContract): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 100));
    const state = lmsrStates[contract.eventId];
    if (!state) return contract.priceAtPurchase;
    
    return contract.outcome === 'YES' ? getPriceYes(state) : getPriceNo(state);
  },
};

export default MarketDataProvider;
