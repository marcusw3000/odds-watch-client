import { MarketEvent, UserPortfolio, UserContract, Transaction, OddsHistoryPoint, Comment } from '@/types/market';

// Mock data - simula dados que virão de uma API/dashboard admin
const mockEvents: MarketEvent[] = [
  {
    id: 'evt-001',
    title: 'O Banco Central vai reduzir a taxa Selic até dezembro?',
    category: 'Economia',
    expiryAt: new Date('2024-12-31T23:59:59'),
    status: 'OPEN',
    outcomes: {
      YES: { price: 65, probability: 65 },
      NO: { price: 35, probability: 35 },
    },
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
    outcomes: {
      YES: { price: 50, probability: 50 },
      NO: { price: 50, probability: 50 },
    },
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
    outcomes: {
      YES: { price: 35, probability: 35 },
      NO: { price: 65, probability: 65 },
    },
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
    outcomes: {
      YES: { price: 72, probability: 72 },
      NO: { price: 28, probability: 28 },
    },
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
    outcomes: {
      YES: { price: 42, probability: 42 },
      NO: { price: 58, probability: 58 },
    },
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

// Mock histórico de odds (últimos 30 dias)
function generateOddsHistory(eventId: string): OddsHistoryPoint[] {
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) return [];

  const history: OddsHistoryPoint[] = [];
  const now = new Date();
  let yesPrice = event.outcomes.YES.price;

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Simula variação natural
    const variation = (Math.random() - 0.5) * 8;
    yesPrice = Math.max(10, Math.min(90, yesPrice + variation));
    
    history.push({
      timestamp: date,
      yesPrice: Math.round(yesPrice),
      noPrice: 100 - Math.round(yesPrice),
    });
  }

  // Último ponto é o preço atual
  history[history.length - 1] = {
    timestamp: now,
    yesPrice: event.outcomes.YES.price,
    noPrice: event.outcomes.NO.price,
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

// Simula variação natural de odds (±1-3 pontos)
function simulateOddsVariation(event: MarketEvent): MarketEvent {
  const variation = (Math.random() - 0.5) * 6; // -3 a +3
  let newYesPrice = Math.round(event.outcomes.YES.price + variation);
  
  // Mantém odds entre 5 e 95
  newYesPrice = Math.max(5, Math.min(95, newYesPrice));
  const newNoPrice = 100 - newYesPrice;
  
  return {
    ...event,
    outcomes: {
      YES: { price: newYesPrice, probability: newYesPrice },
      NO: { price: newNoPrice, probability: newNoPrice },
    },
    lastUpdatedAt: new Date(),
  };
}

// Provider público - cliente só pode LER dados
export const MarketDataProvider = {
  // Busca todos os eventos
  async getEvents(): Promise<MarketEvent[]> {
    // Simula latência de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Retorna eventos com pequena variação para simular mercado dinâmico
    return mockEvents.map(event => ({
      ...event,
      lastUpdatedAt: new Date(),
    }));
  },

  // Busca evento específico por ID
  async getEventById(id: string): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const event = mockEvents.find(e => e.id === id);
    if (!event) return null;
    
    return simulateOddsVariation(event);
  },

  // Busca odds atualizadas (simula refresh)
  async refreshOdds(eventId: string): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const event = mockEvents.find(e => e.id === eventId);
    if (!event) return null;
    
    return simulateOddsVariation(event);
  },

  // Busca eventos por categoria
  async getEventsByCategory(category: string): Promise<MarketEvent[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return mockEvents
      .filter(e => e.category.toLowerCase() === category.toLowerCase())
      .map(event => ({
        ...event,
        lastUpdatedAt: new Date(),
      }));
  },

  // Busca categorias disponíveis
  async getCategories(): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const categories = [...new Set(mockEvents.map(e => e.category))];
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
    return mockEvents.filter(e => 
      e.title.toLowerCase().includes(lowerQuery) ||
      e.category.toLowerCase().includes(lowerQuery)
    );
  },

  // Busca portfolio do usuário
  async getUserPortfolio(): Promise<UserPortfolio> {
    await new Promise(resolve => setTimeout(resolve, 250));
    return { ...mockUserPortfolio };
  },

  // Simula compra de contrato (retorna sucesso/falha)
  async purchaseContract(
    eventId: string,
    outcome: 'YES' | 'NO',
    quantity: number,
    lockedPrice: number
  ): Promise<{ success: boolean; message: string; contract?: UserContract }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const event = mockEvents.find(e => e.id === eventId);
    if (!event) {
      return { success: false, message: 'Evento não encontrado.' };
    }
    
    if (event.status !== 'OPEN') {
      return { success: false, message: 'Este mercado não está aberto para negociação.' };
    }
    
    const currentPrice = event.outcomes[outcome].price;
    const priceDiff = Math.abs(currentPrice - lockedPrice);
    
    // Se preço mudou mais de 5 pontos, rejeita
    if (priceDiff > 5) {
      return { 
        success: false, 
        message: 'O preço mudou significativamente. Por favor, atualize e tente novamente.' 
      };
    }
    
    const totalCost = (lockedPrice / 100) * quantity;
    
    if (totalCost > mockUserPortfolio.balance) {
      return { success: false, message: 'Saldo insuficiente.' };
    }
    
    const newContract: UserContract = {
      id: `ctr-${Date.now()}`,
      eventId,
      eventTitle: event.title,
      outcome,
      quantity,
      priceAtPurchase: lockedPrice,
      purchasedAt: new Date(),
      status: 'ACTIVE',
    };

    // Atualiza portfolio mock
    mockUserPortfolio.balance -= totalCost;
    mockUserPortfolio.contracts.push(newContract);
    mockUserPortfolio.transactions.push({
      id: `tx-${Date.now()}`,
      type: 'BUY',
      amount: -totalCost,
      eventTitle: event.title,
      outcome,
      createdAt: new Date(),
    });
    
    return {
      success: true,
      message: 'Compra realizada com sucesso!',
      contract: newContract,
    };
  },

  // Simula venda de contrato
  async sellContract(
    contractId: string,
    currentMarketPrice: number
  ): Promise<{ success: boolean; message: string; saleValue?: number }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const contractIndex = mockUserPortfolio.contracts.findIndex(c => c.id === contractId);
    if (contractIndex === -1) {
      return { success: false, message: 'Contrato não encontrado.' };
    }

    const contract = mockUserPortfolio.contracts[contractIndex];
    if (contract.status !== 'ACTIVE') {
      return { success: false, message: 'Este contrato não está ativo.' };
    }

    // Valor de venda baseado no preço de mercado atual
    const saleValue = (currentMarketPrice / 100) * contract.quantity;

    // Atualiza portfolio mock
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
    };
  },

  // Busca preço atual de mercado para um contrato
  async getCurrentPriceForContract(contract: UserContract): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 100));
    const event = mockEvents.find(e => e.id === contract.eventId);
    if (!event) return contract.priceAtPurchase;
    return event.outcomes[contract.outcome].price;
  },
};

export default MarketDataProvider;
