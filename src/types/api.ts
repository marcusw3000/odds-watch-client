/**
 * Type definitions for Edge Function API responses.
 * Provides proper typing instead of 'as any' assertions.
 */

// Portfolio Edge Function Response
export interface PortfolioContract {
  id: string;
  eventId: string;
  eventTitle: string;
  outcome: 'YES' | 'NO';
  quantity: number;
  priceAtPurchase: number;
  purchasedAt: string;
  status: 'ACTIVE' | 'WON' | 'LOST';
  payout?: number;
  currentPrice?: number;
  marketStatus?: string;
}

export interface PortfolioTransaction {
  id: string;
  type: string;
  amount: number;
  eventTitle?: string;
  outcome?: string;
  createdAt: string;
}

export interface PortfolioResponse {
  balance: number;
  totalInvested: number;
  totalProfit: number;
  contracts: PortfolioContract[];
  transactions: PortfolioTransaction[];
}

// Balance Edge Function Response
export interface BalanceResponse {
  balance_available: number;
  currency: string;
}

// Admin Users Edge Function Response
export interface AdminUserResponse {
  user_id: string;
  email: string;
  balance_available: number;
  total_deposited: number;
  total_withdrawn: number;
  currency: string;
  display_name?: string;
  created_at: string;
}

export interface AdminUsersListResponse {
  users: AdminUserResponse[];
}

// Admin Ledger Edge Function Response
export interface LedgerEntryResponse {
  id: string;
  user_id: string | null;
  wallet_id: string | null;
  ref_type: string;
  ref_id: string | null;
  direction: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  platform_revenue: number;
  status: string;
  created_at: string;
  fee_snapshot_id: string | null;
  meta: Record<string, unknown> | null;
}

export interface AdminLedgerResponse {
  entries: LedgerEntryResponse[];
}

// Search Users for Mention Response
export interface MentionUserResponse {
  user_id: string;
  display_name: string;
  avatar_url?: string;
}

export interface SearchUsersMentionResponse {
  users: MentionUserResponse[];
}

// Leaderboard Edge Function Response
export interface LeaderboardEntryResponse {
  rank: number;
  user_id: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  total_profit: number;
  roi_percent: number;
  total_volume: number;
  total_trades: number;
  show_profit: boolean;
  show_roi: boolean;
  show_volume: boolean;
  show_trades: boolean;
  is_public: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntryResponse[];
}

// User Display Info Response
export interface UserDisplayInfoResponse {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  is_public: boolean;
}

// Fee Policy Snapshot Response
export interface FeePolicySnapshotResponse {
  snapshot: {
    id: string;
    type: string;
    applied_mode: string;
    applied_percent: number | null;
    applied_flat: number | null;
    applied_tiers: unknown | null;
    fee_rule_id: string | null;
    created_at: string;
  };
}

// Trade Quote Response
export interface TradeQuoteResponse {
  success: boolean;
  quote: {
    outcome: 'YES' | 'NO';
    shares: number;
    pricePerShare: number;
    totalCost: number;
    fee: number;
    estimatedPayout: number;
    newProbability: number;
    priceImpact: number;
  };
}

// Sell Quote Response
export interface SellQuoteResponse {
  success: boolean;
  quote: {
    shares: number;
    pricePerShare: number;
    grossValue: number;
    fee: number;
    netValue: number;
    priceImpact: number;
  };
}

// Comment with author info (for Supabase joins)
export interface CommentWithAuthor {
  id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  user_id: string;
  market_id: string;
  parent_id: string | null;
  likes_count: number;
  replies_count: number;
  is_hidden: boolean;
  mentions: string[] | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}
