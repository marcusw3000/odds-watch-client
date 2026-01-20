export type CopyTraderStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type CopySubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAUSED';
export type CopiedTradeStatus = 'PENDING' | 'EXECUTED' | 'SKIPPED' | 'FAILED' | 'NOTIFIED';

export interface CopyTradeSettings {
  id: string;
  default_monthly_fee: number;
  default_profit_share_percent: number;
  default_trader_split: number;
  default_platform_split: number;
  min_trader_split: number;
  max_trader_split: number;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface CopyTrader {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  status: CopyTraderStatus;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  suspended_at: string | null;
  total_followers: number;
  total_trades_copied: number;
  total_earnings: number;
  win_rate: number | null;
  monthly_fee: number | null;
  profit_share_percent: number | null;
  custom_trader_split: number | null;
  custom_platform_split: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields - fields depend on context (admin vs public)
  profile?: {
    id?: string;
    display_name?: string | null;
    avatar_url?: string | null;
    email?: string | null;  // Only available for admins
  };
}

export interface CopySubscription {
  id: string;
  follower_id: string;
  trader_id: string;
  status: CopySubscriptionStatus;
  auto_copy: boolean;
  max_trade_amount: number | null;
  copy_percentage: number | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  total_trades_copied: number;
  total_profit: number;
  total_commission_paid: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  // Joined fields
  trader?: CopyTrader;
}

export interface CopiedTrade {
  id: string;
  subscription_id: string;
  original_transaction_id: string;
  copied_transaction_id: string | null;
  market_id: string;
  outcome: string;
  original_amount: number;
  copied_amount: number;
  original_price: number;
  copied_price: number | null;
  status: CopiedTradeStatus;
  skip_reason: string | null;
  failure_reason: string | null;
  is_settled: boolean;
  profit_amount: number | null;
  commission_processed: boolean;
  created_at: string;
  executed_at: string | null;
  settled_at: string | null;
  // Joined fields
  market?: {
    title: string;
    status: string;
  };
}

export interface CopyTradeCommission {
  id: string;
  copied_trade_id: string;
  trader_id: string;
  follower_id: string;
  profit_amount: number;
  profit_share_percent: number;
  commission_total: number;
  trader_split_percent: number;
  platform_split_percent: number;
  trader_share: number;
  platform_share: number;
  trader_ledger_id: string | null;
  platform_ledger_id: string | null;
  created_at: string;
}

// Form types
export interface ApplyCopyTraderForm {
  display_name: string;
  bio: string;
}

export interface UpdateCopyTraderSettingsForm {
  default_monthly_fee: number;
  default_profit_share_percent: number;
  default_trader_split: number;
  min_trader_split: number;
  max_trader_split: number;
}

export interface ManageCopyTraderForm {
  action: 'approve' | 'reject' | 'suspend' | 'unsuspend';
  trader_id: string;
  rejection_reason?: string;
  monthly_fee?: number;
  profit_share_percent?: number;
  custom_trader_split?: number;
  custom_platform_split?: number;
}

export interface SubscribeCopyTraderForm {
  trader_id: string;
  auto_copy: boolean;
  max_trade_amount: number;
  copy_percentage: number;
}
