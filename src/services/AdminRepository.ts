// ============= Admin Repository (localStorage Mock) =============
// Easy to replace with real API in the future

import { MarketEvent, AuditLog, EventFormData, MOCK_ADMIN, EventStatus } from '@/types/admin';

const STORAGE_KEYS = {
  EVENTS: 'pm_admin_events',
  AUDIT: 'pm_admin_audit',
};

// Generate unique ID
function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Seed data for initial load
const SEED_EVENTS: MarketEvent[] = [
  {
    id: 'evt_seed_001',
    title: 'Taxa Selic será maior que 12% em Março 2025?',
    description: 'O Banco Central divulgará a taxa Selic na reunião do COPOM. A aposta é se a taxa será superior a 12% ao ano.',
    category: 'Economia',
    status: 'OPEN',
    expiryAt: new Date('2025-03-15'),
    odds: { yes: 65, no: 35 },
    oddsConfig: { mode: 'MANUAL_PROBABILITY', spreadPolicy: 'AUTO_COMPLEMENT' },
    resolutionSource: {
      type: 'API',
      name: 'BCB - Taxa Selic',
      url: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados',
      rule: 'Valor da Selic > 12.00 na data de vencimento',
    },
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-15'),
    createdBy: 'admin-001',
    updatedBy: 'admin-001',
  },
  {
    id: 'evt_seed_002',
    title: 'Dólar acima de R$6.00 no fim de Janeiro 2025?',
    description: 'Taxa PTAX de fechamento do último dia útil de Janeiro 2025.',
    category: 'Economia',
    status: 'OPEN',
    expiryAt: new Date('2025-01-31'),
    odds: { yes: 72, no: 28 },
    oddsConfig: { mode: 'MANUAL_PROBABILITY', spreadPolicy: 'AUTO_COMPLEMENT' },
    resolutionSource: {
      type: 'API',
      name: 'BCB - PTAX',
      url: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados',
      rule: 'PTAX venda >= 6.00 no último dia útil do mês',
    },
    createdAt: new Date('2024-12-10'),
    updatedAt: new Date('2024-12-10'),
    createdBy: 'admin-001',
    updatedBy: 'admin-001',
  },
  {
    id: 'evt_seed_003',
    title: 'Brasil vence a Copa América 2025?',
    description: 'A seleção brasileira será campeã da Copa América 2025.',
    category: 'Esportes',
    status: 'DRAFT',
    expiryAt: new Date('2025-07-15'),
    odds: { yes: 45, no: 55 },
    oddsConfig: { mode: 'MANUAL_PROBABILITY', spreadPolicy: 'AUTO_COMPLEMENT' },
    resolutionSource: {
      type: 'MANUAL',
      name: 'CONMEBOL',
      url: 'https://www.conmebol.com',
      rule: 'Brasil é declarado campeão pela CONMEBOL',
    },
    createdAt: new Date('2024-11-20'),
    updatedAt: new Date('2024-11-20'),
    createdBy: 'admin-001',
    updatedBy: 'admin-001',
  },
  {
    id: 'evt_seed_004',
    title: 'IPCA acumulado 2024 acima de 5%?',
    description: 'Inflação medida pelo IPCA no acumulado de 12 meses.',
    category: 'Economia',
    status: 'CLOSED',
    expiryAt: new Date('2025-01-10'),
    odds: { yes: 80, no: 20 },
    oddsConfig: { mode: 'MANUAL_PROBABILITY', spreadPolicy: 'AUTO_COMPLEMENT' },
    resolutionSource: {
      type: 'DATASET',
      name: 'IBGE - IPCA',
      url: 'https://sidra.ibge.gov.br/tabela/1737',
      rule: 'IPCA acumulado 12 meses > 5.00%',
    },
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2025-01-02'),
    createdBy: 'admin-001',
    updatedBy: 'admin-001',
  },
];

// Initialize storage with seed data if empty
function initializeStorage(): void {
  if (!localStorage.getItem(STORAGE_KEYS.EVENTS)) {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(SEED_EVENTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify([]));
  }
}

// Parse dates from JSON
function parseEvent(event: any): MarketEvent {
  return {
    ...event,
    expiryAt: new Date(event.expiryAt),
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
    settledAt: event.settledAt ? new Date(event.settledAt) : undefined,
  };
}

function parseAuditLog(log: any): AuditLog {
  return {
    ...log,
    timestamp: new Date(log.timestamp),
  };
}

export const AdminRepository = {
  // ============= EVENTS =============

  getEvents(): MarketEvent[] {
    initializeStorage();
    const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const events = data ? JSON.parse(data) : [];
    return events.map(parseEvent);
  },

  getEvent(id: string): MarketEvent | null {
    const events = this.getEvents();
    return events.find(e => e.id === id) || null;
  },

  createEvent(formData: EventFormData): MarketEvent {
    const events = this.getEvents();
    
    const newEvent: MarketEvent = {
      id: generateId(),
      title: formData.title,
      description: formData.description,
      category: formData.category,
      status: 'DRAFT',
      expiryAt: formData.expiryAt,
      odds: { yes: formData.oddsYes, no: formData.oddsNo },
      oddsConfig: formData.oddsConfig,
      resolutionSource: formData.resolutionSource,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: MOCK_ADMIN.id,
      updatedBy: MOCK_ADMIN.id,
    };

    events.push(newEvent);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

    // Log audit
    this.addAuditLog({
      eventId: newEvent.id,
      action: 'CREATED',
      previousValue: null,
      newValue: newEvent.title,
      reason: undefined,
    });

    return newEvent;
  },

  updateEvent(id: string, formData: Partial<EventFormData>, reason?: string): MarketEvent | null {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);
    
    if (index === -1) return null;
    
    const event = events[index];
    
    // Check if odds changed
    const oddsChanged = formData.oddsYes !== undefined && 
      (formData.oddsYes !== event.odds.yes || formData.oddsNo !== event.odds.no);

    const updated: MarketEvent = {
      ...event,
      title: formData.title ?? event.title,
      description: formData.description ?? event.description,
      category: formData.category ?? event.category,
      expiryAt: formData.expiryAt ?? event.expiryAt,
      odds: formData.oddsYes !== undefined 
        ? { yes: formData.oddsYes, no: formData.oddsNo ?? (100 - formData.oddsYes) }
        : event.odds,
      oddsConfig: formData.oddsConfig ?? event.oddsConfig,
      resolutionSource: formData.resolutionSource ?? event.resolutionSource,
      updatedAt: new Date(),
      updatedBy: MOCK_ADMIN.id,
    };

    events[index] = updated;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

    // Log audit
    if (oddsChanged) {
      this.addAuditLog({
        eventId: id,
        action: 'ODDS_CHANGED',
        previousValue: `SIM: ${event.odds.yes}% / NÃO: ${event.odds.no}%`,
        newValue: `SIM: ${updated.odds.yes}% / NÃO: ${updated.odds.no}%`,
        reason,
      });
    } else {
      this.addAuditLog({
        eventId: id,
        action: 'EDITED',
        previousValue: null,
        newValue: 'Evento editado',
        reason,
      });
    }

    return updated;
  },

  updateStatus(id: string, status: EventStatus, reason?: string): MarketEvent | null {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);
    
    if (index === -1) return null;
    
    const event = events[index];
    const previousStatus = event.status;

    events[index] = {
      ...event,
      status,
      updatedAt: new Date(),
      updatedBy: MOCK_ADMIN.id,
    };

    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

    // Determine action type
    let action: AuditLog['action'] = 'STATUS_CHANGED';
    if (status === 'PAUSED') action = 'PAUSED';
    if (status === 'OPEN' && previousStatus === 'PAUSED') action = 'RESUMED';
    if (status === 'CLOSED') action = 'CLOSED';

    this.addAuditLog({
      eventId: id,
      action,
      previousValue: previousStatus,
      newValue: status,
      reason,
    });

    return events[index];
  },

  settleEvent(id: string, result: 'YES' | 'NO', evidence: string): MarketEvent | null {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);
    
    if (index === -1) return null;
    
    const event = events[index];

    events[index] = {
      ...event,
      status: 'SETTLED',
      settlementResult: result,
      settlementEvidence: evidence,
      settledAt: new Date(),
      updatedAt: new Date(),
      updatedBy: MOCK_ADMIN.id,
    };

    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

    this.addAuditLog({
      eventId: id,
      action: 'SETTLED',
      previousValue: 'CLOSED',
      newValue: `Resultado: ${result === 'YES' ? 'SIM' : 'NÃO'}`,
      reason: evidence,
    });

    return events[index];
  },

  deleteEvent(id: string): boolean {
    const events = this.getEvents();
    const filtered = events.filter(e => e.id !== id);
    
    if (filtered.length === events.length) return false;
    
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(filtered));
    return true;
  },

  // ============= AUDIT =============

  getAuditLogs(): AuditLog[] {
    initializeStorage();
    const data = localStorage.getItem(STORAGE_KEYS.AUDIT);
    const logs = data ? JSON.parse(data) : [];
    return logs.map(parseAuditLog).sort((a: AuditLog, b: AuditLog) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  },

  getEventAuditLogs(eventId: string): AuditLog[] {
    return this.getAuditLogs().filter(log => log.eventId === eventId);
  },

  addAuditLog(data: Omit<AuditLog, 'id' | 'admin' | 'timestamp'>): AuditLog {
    const logs = this.getAuditLogs();
    
    const newLog: AuditLog = {
      id: `log_${Date.now()}`,
      ...data,
      admin: MOCK_ADMIN.name,
      timestamp: new Date(),
    };

    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(logs));

    return newLog;
  },

  // ============= METRICS =============

  getMetrics() {
    const events = this.getEvents();
    
    return {
      totalEvents: events.length,
      openEvents: events.filter(e => e.status === 'OPEN').length,
      pausedEvents: events.filter(e => e.status === 'PAUSED').length,
      closedEvents: events.filter(e => e.status === 'CLOSED').length,
      awaitingSettlement: events.filter(e => 
        e.status === 'CLOSED' && new Date(e.expiryAt) < new Date()
      ).length,
      settledEvents: events.filter(e => e.status === 'SETTLED').length,
    };
  },

  // ============= UTILITIES =============

  getExpiringEvents(days: number = 7): MarketEvent[] {
    const events = this.getEvents();
    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return events
      .filter(e => e.status === 'OPEN' && e.expiryAt <= threshold && e.expiryAt > now)
      .sort((a, b) => a.expiryAt.getTime() - b.expiryAt.getTime());
  },

  getRecentlyUpdatedEvents(limit: number = 5): MarketEvent[] {
    return this.getEvents()
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  },
};
