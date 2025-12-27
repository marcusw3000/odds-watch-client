import { MarketEvent, UserPortfolio, UserContract, Transaction } from '@/types/market';

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
  },
];

const mockUserPortfolio: UserPortfolio = {
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
    
    return {
      success: true,
      message: 'Compra realizada com sucesso!',
      contract: newContract,
    };
  },
};

export default MarketDataProvider;
