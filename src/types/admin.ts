// ============= Admin Types for Prediction Market =============

import { MarketStatus } from './market';

// Re-export MarketStatus for backwards compatibility
export type EventStatus = MarketStatus;

// Liquidity Configuration
export type LiquidityLevel = 'low' | 'medium' | 'high';

export const LIQUIDITY_CONFIG = {
  low: { b: 100, label: 'Baixa', description: 'Preços sensíveis, ideal para nichos', impact: '±15-20%' },
  medium: { b: 300, label: 'Média', description: 'Equilíbrio entre sensibilidade e estabilidade', impact: '±5-8%' },
  high: { b: 500, label: 'Alta', description: 'Preços estáveis, ideal para alto volume', impact: '±3-5%' },
} as const;

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

// NOTE: AuditLog is now handled by useAdminAuditLogs hook using admin_audit_logs table

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

// NOTE: MOCK_ADMIN removed - now using real auth from Supabase
