import { LMSRState } from '@/services/LMSRCalculator';

export type MarketStatus = 'OPEN' | 'HALTED' | 'PENDING' | 'CONTESTED' | 'SETTLED';
export type MarketType = 'BINARY' | 'MULTIPLE';
export type SettlementType = 
  | 'MANUAL'
  | 'SELIC'
  | 'SELIC_META'
  | 'IPCA'
  | 'IPCA_12M'
  | 'CDI'
  | 'PTAX'
  | 'PTAX_USD'
  | 'PTAX_EUR'
  | 'PIB';

export interface SettlementConfig {
  threshold: number;
  operator: 'lt' | 'gt' | 'lte' | 'gte' | 'eq';
  description?: string;
  unit?: 'percent' | 'currency' | 'points';
}

export interface Outcome {
  price: number; // em centavos (ex: 65 = R$0.65)
  probability: number; // percentual (ex: 65 = 65%)
}

// Market option for multiple-choice markets
export interface MarketOption {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string;
  shares: number;
  currentPrice: number;
  displayOrder: number;
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
  createdAt: Date;
  lastUpdatedAt: Date;
  volume?: number;
  description?: string;
  settlementRules?: string[];
  lmsr: LMSRState;
  
  // Market type - BINARY (yes/no) or MULTIPLE (multiple options)
  marketType: MarketType;
  optionsExclusive: boolean;  // For MULTIPLE: true = only one can win
  options?: MarketOption[];   // Options for MULTIPLE type markets
  
  // Settlement type
  settlementType?: SettlementType;
  settlementConfig?: SettlementConfig;
  
  // Lifecycle timestamps
  tradingHaltAt: Date;    // When trading stops
  eventAt: Date;          // When the actual event occurs
  contestEndAt?: Date;    // End of contestation period
  settledAt?: Date;       // When market was settled
  
  // Result and contestation
  result?: 'YES' | 'NO' | string;  // Can be YES/NO for binary or option id for multiple
  resultSource?: string;           // Source of result (API, admin)
  resultSubmittedAt?: Date;        // When result was submitted
  contestations?: Contestation[];  // List of contestations
  
  // Image
  imageUrl?: string;
  imageZoom?: number;
  imagePosition?: { x: number; y: number };
  haltReason?: string;
  
  // Contract cost
  contractUnitCost: number;  // Value paid per winning contract (default R$100)
  
  // Tags for categorization
  tags?: string[];
  
  // Card display style
  cardStyle?: 'default' | 'buttons' | 'simple' | 'minimal';
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
  result: string | null;
  result_source: string | null;
  close_date: string | null;
  settlement_date: string | null;
  halt_reason: string | null;
  created_at: string;
  updated_at: string;
  contract_unit_cost: number;
  market_type: string;
  options_exclusive: boolean;
  tags: string[] | null;
  card_style: string | null;
}

// Database market option type
export interface DbMarketOption {
  id: string;
  market_id: string;
  label: string;
  description: string | null;
  image_url: string | null;
  shares: number;
  current_price: number;
  display_order: number;
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
  SELIC: 'Taxa SELIC (Mensal)',
  SELIC_META: 'Meta SELIC (COPOM)',
  IPCA: 'IPCA (Mensal)',
  IPCA_12M: 'IPCA Acumulado 12 meses',
  CDI: 'Taxa CDI',
  PTAX: 'Dólar PTAX (Legacy)',
  PTAX_USD: 'Dólar PTAX',
  PTAX_EUR: 'Euro PTAX',
  PIB: 'PIB (Anual)',
};

export const OPERATOR_LABELS: Record<string, string> = {
  lt: 'menor que',
  gt: 'maior que',
  lte: 'menor ou igual a',
  gte: 'maior ou igual a',
  eq: 'igual a',
};

// Units for each settlement type
export const SETTLEMENT_TYPE_UNITS: Record<SettlementType, { unit: string; placeholder: string }> = {
  MANUAL: { unit: '', placeholder: '0' },
  SELIC: { unit: '%', placeholder: 'Ex: 10.5' },
  SELIC_META: { unit: '%', placeholder: 'Ex: 10.5' },
  IPCA: { unit: '%', placeholder: 'Ex: 0.5' },
  IPCA_12M: { unit: '%', placeholder: 'Ex: 4.5' },
  CDI: { unit: '%', placeholder: 'Ex: 10.4' },
  PTAX: { unit: 'R$', placeholder: 'Ex: 5.80' },
  PTAX_USD: { unit: 'R$', placeholder: 'Ex: 5.80' },
  PTAX_EUR: { unit: 'R$', placeholder: 'Ex: 6.30' },
  PIB: { unit: '%', placeholder: 'Ex: 2.5' },
};

// Market status labels in Portuguese
export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = {
  OPEN: 'Aberto',
  HALTED: 'Pausado',
  PENDING: 'Aguardando Resultado',
  CONTESTED: 'Em Contestação',
  SETTLED: 'Encerrado',
};

// Market status descriptions in Portuguese
export const MARKET_STATUS_DESCRIPTIONS: Record<MarketStatus, string> = {
  OPEN: 'Negociações abertas',
  HALTED: 'Negociações pausadas até o evento',
  PENDING: 'Aguardando resultado oficial',
  CONTESTED: 'Período de contestação ativo',
  SETTLED: 'Mercado finalizado',
};

// Badge variants for each status
export const MARKET_STATUS_VARIANTS: Record<MarketStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'default',
  HALTED: 'secondary',
  PENDING: 'outline',
  CONTESTED: 'destructive',
  SETTLED: 'outline',
};
