import { MarketEvent, MarketStatus, Contestation } from '@/types/market';
import { AdminMetrics, MarketFormData, ContestationReviewData, AuditLogEntry, ContestationWithEvent } from '@/types/admin';
import { initializeLMSR } from './LMSRCalculator';

// In-memory storage for admin operations (simulating a database)
let mockMarkets: MarketEvent[] = [];
let auditLog: AuditLogEntry[] = [];

// Helper to create dates relative to now
function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// Initialize with some mock markets
function initializeMockMarkets(): MarketEvent[] {
  const lmsrState1 = initializeLMSR(65, 100);
  const lmsrState2 = initializeLMSR(50, 100);
  const lmsrState3 = initializeLMSR(35, 80);
  const lmsrState4 = initializeLMSR(72, 120);
  const lmsrState5 = initializeLMSR(42, 150);

  return [
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
      tradingHaltAt: hoursFromNow(2),
      eventAt: hoursFromNow(3),
      outcomes: { YES: { price: 65, probability: 65 }, NO: { price: 35, probability: 35 } },
      lmsr: lmsrState1,
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
      tradingHaltAt: hoursFromNow(48),
      eventAt: hoursFromNow(50),
      outcomes: { YES: { price: 50, probability: 50 }, NO: { price: 50, probability: 50 } },
      lmsr: lmsrState2,
    },
    {
      id: 'evt-003',
      title: 'O Brasil ganhará mais de 10 medalhas de ouro nas próximas Olimpíadas?',
      category: 'Esportes',
      expiryAt: new Date('2024-08-11T23:59:59'),
      status: 'PENDING',
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
      tradingHaltAt: new Date(Date.now() - 1000 * 60 * 60),
      eventAt: new Date(Date.now() - 1000 * 60 * 30),
      outcomes: { YES: { price: 35, probability: 35 }, NO: { price: 65, probability: 65 } },
      lmsr: lmsrState3,
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
      tradingHaltAt: hoursFromNow(168),
      eventAt: hoursFromNow(170),
      outcomes: { YES: { price: 72, probability: 72 }, NO: { price: 28, probability: 28 } },
      lmsr: lmsrState4,
    },
    {
      id: 'evt-005',
      title: 'O Ibovespa fechará acima de 140.000 pontos em 2024?',
      category: 'Mercado',
      expiryAt: new Date('2024-12-30T18:00:00'),
      status: 'CONTESTED',
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
      tradingHaltAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      eventAt: new Date(Date.now() - 1000 * 60 * 60 * 22),
      contestEndAt: hoursFromNow(24),
      result: 'YES',
      resultSource: 'B3 API',
      resultSubmittedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      contestations: [
        {
          id: 'cont-001',
          userId: 'user-123',
          reason: 'O fechamento considerado foi o after-market, não o oficial',
          evidence: 'https://b3.com.br/fechamento-oficial',
          submittedAt: new Date(Date.now() - 1000 * 60 * 60),
          status: 'OPEN',
        },
      ],
      outcomes: { YES: { price: 42, probability: 42 }, NO: { price: 58, probability: 58 } },
      lmsr: lmsrState5,
    },
  ];
}

// Initialize markets on first load
if (mockMarkets.length === 0) {
  mockMarkets = initializeMockMarkets();
}

// Add audit log entry
function addAuditLog(action: string, admin: string, details: string, eventId?: string) {
  auditLog.unshift({
    id: `audit-${Date.now()}`,
    action,
    timestamp: new Date(),
    admin,
    eventId,
    details,
  });
}

export const AdminDataProvider = {
  // === MARKETS ===

  // Get all markets
  async getMarkets(): Promise<MarketEvent[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return [...mockMarkets];
  },

  // Get single market
  async getMarket(id: string): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockMarkets.find(m => m.id === id) || null;
  },

  // Create new market
  async createMarket(data: MarketFormData): Promise<MarketEvent> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const lmsrState = initializeLMSR(data.initialYesOdds, data.liquidity);
    
    const newMarket: MarketEvent = {
      id: `evt-${Date.now()}`,
      title: data.title,
      category: data.category,
      description: data.description,
      settlementRules: data.settlementRules,
      expiryAt: data.expiryAt,
      tradingHaltAt: data.tradingHaltAt,
      eventAt: data.eventAt,
      status: 'OPEN',
      limits: data.limits,
      lastUpdatedAt: new Date(),
      volume: 0,
      outcomes: {
        YES: { price: data.initialYesOdds, probability: data.initialYesOdds },
        NO: { price: 100 - data.initialYesOdds, probability: 100 - data.initialYesOdds },
      },
      lmsr: lmsrState,
    };

    mockMarkets.push(newMarket);
    addAuditLog('CREATE_MARKET', 'admin', `Mercado criado: ${data.title}`, newMarket.id);
    
    return newMarket;
  },

  // Update market
  async updateMarket(id: string, data: Partial<MarketFormData>): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = mockMarkets.findIndex(m => m.id === id);
    if (index === -1) return null;

    const market = mockMarkets[index];
    
    // Update allowed fields
    if (data.title) market.title = data.title;
    if (data.category) market.category = data.category;
    if (data.description) market.description = data.description;
    if (data.settlementRules) market.settlementRules = data.settlementRules;
    if (data.expiryAt) market.expiryAt = data.expiryAt;
    if (data.tradingHaltAt) market.tradingHaltAt = data.tradingHaltAt;
    if (data.eventAt) market.eventAt = data.eventAt;
    if (data.limits) market.limits = data.limits;
    
    market.lastUpdatedAt = new Date();
    mockMarkets[index] = market;
    
    addAuditLog('UPDATE_MARKET', 'admin', `Mercado atualizado: ${market.title}`, id);
    
    return market;
  },

  // Delete market (only if no contracts)
  async deleteMarket(id: string): Promise<{ success: boolean; message: string }> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = mockMarkets.findIndex(m => m.id === id);
    if (index === -1) {
      return { success: false, message: 'Mercado não encontrado.' };
    }

    const market = mockMarkets[index];
    if ((market.volume || 0) > 0) {
      return { success: false, message: 'Não é possível excluir mercado com volume negociado.' };
    }

    mockMarkets.splice(index, 1);
    addAuditLog('DELETE_MARKET', 'admin', `Mercado excluído: ${market.title}`, id);
    
    return { success: true, message: 'Mercado excluído com sucesso.' };
  },

  // === STATUS CONTROL ===

  // Force halt (emergency)
  async forceHalt(eventId: string, reason: string): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = mockMarkets.findIndex(m => m.id === eventId);
    if (index === -1) return null;

    mockMarkets[index].status = 'HALTED';
    mockMarkets[index].lastUpdatedAt = new Date();
    
    addAuditLog('FORCE_HALT', 'admin', `Halt forçado: ${reason}`, eventId);
    
    return mockMarkets[index];
  },

  // Resume trading
  async resumeTrading(eventId: string): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = mockMarkets.findIndex(m => m.id === eventId);
    if (index === -1) return null;

    mockMarkets[index].status = 'OPEN';
    mockMarkets[index].lastUpdatedAt = new Date();
    
    addAuditLog('RESUME_TRADING', 'admin', 'Trading retomado', eventId);
    
    return mockMarkets[index];
  },

  // Update lifecycle timestamps
  async updateLifecycle(
    eventId: string, 
    data: { tradingHaltAt?: Date; eventAt?: Date; contestEndAt?: Date }
  ): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = mockMarkets.findIndex(m => m.id === eventId);
    if (index === -1) return null;

    if (data.tradingHaltAt) mockMarkets[index].tradingHaltAt = data.tradingHaltAt;
    if (data.eventAt) mockMarkets[index].eventAt = data.eventAt;
    if (data.contestEndAt) mockMarkets[index].contestEndAt = data.contestEndAt;
    mockMarkets[index].lastUpdatedAt = new Date();
    
    addAuditLog('UPDATE_LIFECYCLE', 'admin', 'Datas atualizadas', eventId);
    
    return mockMarkets[index];
  },

  // === SETTLEMENT ===

  // Submit official result
  async submitResult(
    eventId: string, 
    result: 'YES' | 'NO', 
    source: string,
    contestPeriodHours: number = 48
  ): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const index = mockMarkets.findIndex(m => m.id === eventId);
    if (index === -1) return null;

    mockMarkets[index].status = 'CONTESTED';
    mockMarkets[index].result = result;
    mockMarkets[index].resultSource = source;
    mockMarkets[index].resultSubmittedAt = new Date();
    mockMarkets[index].contestEndAt = new Date(Date.now() + contestPeriodHours * 60 * 60 * 1000);
    mockMarkets[index].lastUpdatedAt = new Date();
    
    addAuditLog('SUBMIT_RESULT', 'admin', `Resultado: ${result} (fonte: ${source})`, eventId);
    
    return mockMarkets[index];
  },

  // Execute settlement (payout)
  async executeSettlement(eventId: string): Promise<{
    success: boolean;
    message: string;
    payouts?: Array<{ userId: string; amount: number }>;
  }> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const index = mockMarkets.findIndex(m => m.id === eventId);
    if (index === -1) {
      return { success: false, message: 'Mercado não encontrado.' };
    }

    const market = mockMarkets[index];
    if (!market.result) {
      return { success: false, message: 'Resultado não foi informado.' };
    }

    // Check contestation period
    if (market.contestEndAt && new Date() < market.contestEndAt) {
      const hasOpenContestations = market.contestations?.some(c => c.status === 'OPEN');
      if (hasOpenContestations) {
        return { success: false, message: 'Existem contestações pendentes.' };
      }
    }

    mockMarkets[index].status = 'SETTLED';
    mockMarkets[index].settledAt = new Date();
    mockMarkets[index].lastUpdatedAt = new Date();
    
    // Mock payouts
    const payouts = [
      { userId: 'user-001', amount: 500 },
      { userId: 'user-002', amount: 1200 },
      { userId: 'user-003', amount: 350 },
    ];
    
    addAuditLog('EXECUTE_SETTLEMENT', 'admin', `Liquidado como ${market.result}`, eventId);
    
    return { success: true, message: 'Mercado liquidado com sucesso.', payouts };
  },

  // Revert result (if contestation accepted)
  async revertResult(eventId: string): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = mockMarkets.findIndex(m => m.id === eventId);
    if (index === -1) return null;

    mockMarkets[index].status = 'PENDING';
    mockMarkets[index].result = undefined;
    mockMarkets[index].resultSource = undefined;
    mockMarkets[index].resultSubmittedAt = undefined;
    mockMarkets[index].contestEndAt = undefined;
    mockMarkets[index].lastUpdatedAt = new Date();
    
    addAuditLog('REVERT_RESULT', 'admin', 'Resultado revertido para revisão', eventId);
    
    return mockMarkets[index];
  },

  // === CONTESTATIONS ===

  // Get all pending contestations
  async getPendingContestations(): Promise<ContestationWithEvent[]> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const result: ContestationWithEvent[] = [];
    
    for (const market of mockMarkets) {
      if (market.contestations) {
        for (const contestation of market.contestations) {
          if (contestation.status === 'OPEN') {
            result.push({ ...contestation, event: market });
          }
        }
      }
    }
    
    return result;
  },

  // Review contestation
  async reviewContestation(data: ContestationReviewData): Promise<Contestation | null> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const marketIndex = mockMarkets.findIndex(m => m.id === data.eventId);
    if (marketIndex === -1) return null;

    const market = mockMarkets[marketIndex];
    if (!market.contestations) return null;

    const contestIndex = market.contestations.findIndex(c => c.id === data.contestationId);
    if (contestIndex === -1) return null;

    market.contestations[contestIndex].status = data.status === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';
    market.contestations[contestIndex].reviewedAt = new Date();
    market.contestations[contestIndex].reviewNotes = data.reviewNotes;
    
    addAuditLog(
      'REVIEW_CONTESTATION', 
      'admin', 
      `Contestação ${data.status === 'ACCEPTED' ? 'aceita' : 'rejeitada'}: ${data.reviewNotes}`,
      data.eventId
    );

    // If accepted, revert the result
    if (data.status === 'ACCEPTED') {
      await this.revertResult(data.eventId);
    }
    
    return market.contestations[contestIndex];
  },

  // === LMSR / ODDS ===

  // Adjust liquidity
  async adjustLiquidity(eventId: string, newB: number): Promise<MarketEvent | null> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = mockMarkets.findIndex(m => m.id === eventId);
    if (index === -1) return null;

    mockMarkets[index].lmsr.b = newB;
    mockMarkets[index].lastUpdatedAt = new Date();
    
    addAuditLog('ADJUST_LIQUIDITY', 'admin', `Liquidez ajustada para b=${newB}`, eventId);
    
    return mockMarkets[index];
  },

  // === METRICS ===

  // Get dashboard metrics
  async getMetrics(): Promise<AdminMetrics> {
    await new Promise(resolve => setTimeout(resolve, 150));

    const statusCounts = {
      OPEN: 0,
      HALTED: 0,
      PENDING: 0,
      CONTESTED: 0,
      SETTLED: 0,
    };

    let totalVolume = 0;
    let pendingContestations = 0;

    for (const market of mockMarkets) {
      statusCounts[market.status]++;
      totalVolume += market.volume || 0;
      if (market.contestations) {
        pendingContestations += market.contestations.filter(c => c.status === 'OPEN').length;
      }
    }

    return {
      totalMarkets: mockMarkets.length,
      openMarkets: statusCounts.OPEN,
      haltedMarkets: statusCounts.HALTED,
      pendingMarkets: statusCounts.PENDING,
      contestedMarkets: statusCounts.CONTESTED,
      settledMarkets: statusCounts.SETTLED,
      totalVolume,
      totalUsers: 156, // Mock
      pendingContestations,
    };
  },

  // Get audit log
  async getAuditLog(eventId?: string): Promise<AuditLogEntry[]> {
    await new Promise(resolve => setTimeout(resolve, 100));

    if (eventId) {
      return auditLog.filter(e => e.eventId === eventId);
    }
    return [...auditLog];
  },

  // Get categories
  async getCategories(): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return [...new Set(mockMarkets.map(m => m.category))];
  },
};
