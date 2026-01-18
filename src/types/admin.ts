// ============= Admin Types for Prediction Market =============

import { MarketStatus } from './market';

// Re-export MarketStatus for backwards compatibility
export type EventStatus = MarketStatus;

// Resolution Source Types
export type ResolutionSourceType = 'API' | 'DATASET' | 'MANUAL';

// Resolution Source
export interface ResolutionSource {
  type: ResolutionSourceType;
  name: string;
  url: string;
  rule: string;
}

// Odds
export interface Odds {
  yes: number;
  no: number;
}

// Audit Log Entry
export interface AuditLog {
  id: string;
  eventId: string;
  action: 'CREATED' | 'ODDS_CHANGED' | 'STATUS_CHANGED' | 'PAUSED' | 'RESUMED' | 'CLOSED' | 'SETTLED' | 'EDITED';
  previousValue: string | null;
  newValue: string;
  admin: string;
  reason?: string;
  timestamp: Date;
}

// Market Event (Admin Model)
export interface MarketEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  status: EventStatus;
  expiryAt: Date;

  odds: Odds;

  resolutionSource: ResolutionSource;

  settlementResult?: 'YES' | 'NO';
  settlementEvidence?: string;
  settledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// Form data for creating/editing events
export interface EventFormData {
  title: string;
  description: string;
  category: string;
  expiryAt: Date;
  
  resolutionSource: ResolutionSource;
  
  oddsYes: number;
  
  oddsChangeReason?: string;
  
  cardStyle?: 'default' | 'buttons' | 'simple' | 'minimal';
}

// Dashboard Metrics
export interface AdminMetrics {
  totalEvents: number;
  openEvents: number;
  pausedEvents: number;
  closedEvents: number;
  awaitingSettlement: number;
  settledEvents: number;
}

// Categories
export const EVENT_CATEGORIES = [
  'Economia',
  'Política',
  'Esportes',
  'Tecnologia',
  'Entretenimento',
  'Internacional',
  'Clima',
  'Outros',
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

// Mock Admin User
export const MOCK_ADMIN = {
  id: 'admin-001',
  name: 'Administrador',
  email: 'admin@predictionmarket.br',
};
