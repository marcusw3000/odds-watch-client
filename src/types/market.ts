import { LMSRState } from '@/services/LMSRCalculator';

export type MarketStatus = 'OPEN' | 'HALTED' | 'PENDING' | 'CONTESTED' | 'SETTLED';
export type SettlementType = 'MANUAL' | 'SELIC' | 'SELIC_META' | 'IPCA' | 'CDI' | 'PTAX';

export interface SettlementConfig {
  threshold: number;
  operator: 'lt' | 'gt' | 'lte' | 'gte' | 'eq';
  description?: string;
}

export interface Outcome {
  price: number; // em centavos (ex: 65 = R$0.65)
  probability: number; // percentual (ex: 65 = 65%)
}

export type { LMSRState };

export interface MarketLimits {
  minBuy: number;
  maxBuy: number;
}

export interface OddsHistoryPoint {
  timestamp: Date;
  yesPrice: number;
  noPrice: number;
}

export interface Contestation {
  id: string;
  userId: string;
  reason: string;
  evidence?: string;
  submittedAt: Date;
  status: 'OPEN' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED';
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface MarketEvent {
  id: string;
  title: string;
  category: string;
  expiryAt: Date;
  status: MarketStatus;
  outcomes: {
    YES: Outcome;
    NO: Outcome;
  };
  limits: MarketLimits;
  lastUpdatedAt: Date;
  volume?: number;
  description?: string;
  settlementRules?: string[];
  lmsr: LMSRState;
  
  // Settlement type
  settlementType?: SettlementType;
  settlementConfig?: SettlementConfig;
  
  // Lifecycle timestamps
  tradingHaltAt: Date;    // When trading stops
  eventAt: Date;          // When the actual event occurs
  contestEndAt?: Date;    // End of contestation period
  settledAt?: Date;       // When market was settled
  
  // Result and contestation
  result?: 'YES' | 'NO';           // Official result
  resultSource?: string;           // Source of result (API, admin)
  resultSubmittedAt?: Date;        // When result was submitted
  contestations?: Contestation[];  // List of contestations
  
  // Image
  imageUrl?: string;
  haltReason?: string;
}

// Database market type (from Supabase)
export interface DbMarket {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_url: string | null;
  status: MarketStatus;
  settlement_type: SettlementType;
  settlement_config: SettlementConfig | null;
  current_yes_price: number;
  current_no_price: number;
  total_volume: number;
  liquidity_pool: number;
  lmsr_b: number;
  yes_shares: number;
  no_shares: number;
  result: 'YES' | 'NO' | null;
  result_source: string | null;
  close_date: string | null;
  settlement_date: string | null;
  halt_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserContract {
  id: string;
  eventId: string;
  eventTitle: string;
  outcome: 'YES' | 'NO';
  quantity: number;
  priceAtPurchase: number;
  purchasedAt: Date;
  status: 'ACTIVE' | 'WON' | 'LOST';
  payout?: number;
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL' | 'PAYOUT' | 'DEPOSIT';
  amount: number;
  eventTitle?: string;
  outcome?: 'YES' | 'NO';
  createdAt: Date;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  likes: number;
}

export interface UserPortfolio {
  balance: number;
  contracts: UserContract[];
  transactions: Transaction[];
  totalProfit: number;
}

// Settlement type labels for UI
export const SETTLEMENT_TYPE_LABELS: Record<SettlementType, string> = {
  MANUAL: 'Manual (Admin)',
  SELIC: 'Taxa SELIC',
  SELIC_META: 'Meta SELIC (COPOM)',
  IPCA: 'IPCA (Inflação)',
  CDI: 'Taxa CDI',
  PTAX: 'Dólar PTAX',
};

export const OPERATOR_LABELS: Record<string, string> = {
  lt: 'menor que',
  gt: 'maior que',
  lte: 'menor ou igual a',
  gte: 'maior ou igual a',
  eq: 'igual a',
};
