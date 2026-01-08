import { LMSRState } from '@/services/LMSRCalculator';

export type MarketStatus = 'OPEN' | 'HALTED' | 'PENDING' | 'CONTESTED' | 'SETTLED';

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
