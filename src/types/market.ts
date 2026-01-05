import { LMSRState } from '@/services/LMSRCalculator';

export type MarketStatus = 'OPEN' | 'CLOSED' | 'SETTLED';

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
