// ============= Financial System Types =============

// Fee Types
export type FeeType = 'DEPOSIT' | 'WITHDRAW' | 'TRADE' | 'SETTLEMENT';
export type FeeMode = 'PERCENT' | 'FIXED' | 'TIERED' | 'KALSHI';
export type LedgerDirection = 'CREDIT' | 'DEBIT';
export type LedgerStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type LedgerRefType = 'DEPOSIT' | 'WITHDRAW' | 'TRADE' | 'SETTLEMENT' | 'FEE' | 'ADJUSTMENT';

// Fee Tier
export interface FeeTier {
  min: number;
  max: number | null;
  percent: number;
}

// Fee Rule
export interface FeeRule {
  id: string;
  name: string;
  type: FeeType;
  mode: FeeMode;
  tiers: FeeTier[];
  flat_value: number | null;
  percent_value: number | null;
  min_fee: number | null;
  max_fee: number | null;
  is_active: boolean;
  effective_from: string;
  created_by: string | null;
  created_at: string;
}

// Fee Policy Snapshot
export interface FeePolicySnapshot {
  id: string;
  fee_rule_id: string;
  type: string;
  applied_mode: string;
  applied_tiers: FeeTier[] | null;
  applied_percent: number | null;
  applied_flat: number | null;
  created_at: string;
}

// Profile
export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Wallet
export interface Wallet {
  id: string;
  user_id: string;
  balance_available: number;
  balance_locked: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

// Wallet with Profile (from VIEW)
export interface WalletWithProfile extends Wallet {
  email: string | null;
  full_name: string | null;
}

// Ledger Entry
export interface LedgerEntry {
  id: string;
  user_id: string | null;
  wallet_id: string | null;
  ref_type: LedgerRefType;
  ref_id: string | null;
  direction: LedgerDirection;
  amount: number;
  fee_amount: number;
  net_amount: number;
  platform_revenue: number;
  fee_snapshot_id: string | null;
  status: LedgerStatus;
  meta: Record<string, unknown>;
  created_at: string;
}

// Platform Revenue
export interface PlatformRevenue {
  id: string;
  day: string;
  type: string;
  gross: number;
  fees: number;
  net: number;
  created_at: string;
  updated_at: string;
}

// Admin Audit Log
export interface AdminAuditLog {
  id: string;
  actor_user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Fee Calculation Result
export interface FeeCalculationResult {
  feeAmount: number;
  netAmount: number;
  appliedRule: FeeRule;
  tier?: FeeTier;
}

// Form types
export interface FeeRuleFormData {
  name: string;
  type: FeeType;
  mode: FeeMode;
  tiers: FeeTier[];
  flat_value: number | null;
  percent_value: number | null;
  min_fee: number | null;
  max_fee: number | null;
  effective_from: Date;
}

// Dashboard metrics
export interface FinancialMetrics {
  revenueToday: number;
  revenue7Days: number;
  revenue30Days: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalTrades: number;
  avgFeeByType: Record<FeeType, number>;
  activeUsers: number;
}

// Revenue by day
export interface RevenueByDay {
  day: string;
  amount: number;
  type: string;
}

// User with wallet
export interface UserWithWallet {
  id: string;
  email: string;
  balance_available: number;
  balance_locked: number;
  is_blocked: boolean;
  created_at: string;
}
