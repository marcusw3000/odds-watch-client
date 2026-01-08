import { MarketStatus, Contestation, MarketEvent, SettlementType, SettlementConfig } from './market';

// Form data for creating/editing markets
export interface MarketFormData {
  title: string;
  category: string;
  description: string;
  settlementRules: string[];
  expiryAt: Date;
  tradingHaltAt: Date;
  eventAt: Date;
  limits: { minBuy: number; maxBuy: number };
  initialYesOdds: number;      // Initial odds (1-99)
  liquidity: number;           // LMSR b parameter
  settlementType: SettlementType;
  settlementConfig?: SettlementConfig;
}

// Market status action
export interface StatusAction {
  action: 'HALT' | 'RESUME' | 'PENDING' | 'SETTLE';
  reason?: string;
  result?: 'YES' | 'NO';
  source?: string;
}

// Dashboard metrics
export interface AdminMetrics {
  totalMarkets: number;
  openMarkets: number;
  haltedMarkets: number;
  pendingMarkets: number;
  contestedMarkets: number;
  settledMarkets: number;
  totalVolume: number;
  totalUsers: number;
  pendingContestations: number;
  automaticMarkets?: number;
}

// Contestation review
export interface ContestationReviewData {
  contestationId: string;
  eventId: string;
  status: 'ACCEPTED' | 'REJECTED';
  reviewNotes: string;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  action: string;
  timestamp: Date;
  admin: string;
  eventId?: string;
  details: string;
}

// Extended contestation with event info
export interface ContestationWithEvent extends Contestation {
  event: MarketEvent;
}

// BCB data point
export interface BCBDataPoint {
  indicator: string;
  value: number;
  date: string;
  fromCache: boolean;
}

// Market settlement record
export interface MarketSettlement {
  id: string;
  marketId: string;
  result: 'YES' | 'NO';
  source: string;
  apiValue: number | null;
  apiResponse: unknown;
  settledAt: Date;
  isAutomatic: boolean;
}
