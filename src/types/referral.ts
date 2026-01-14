export type ReferralStatus = 'PENDING' | 'ACTIVATED' | 'EXPIRED';

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  referral_code: string;
  status: ReferralStatus;
  commission_percent: number;
  discount_percent: number;
  total_commission_earned: number;
  activated_at: string | null;
  discount_expires_at: string | null;
  created_at: string;
}

export interface ReferralCommission {
  id: string;
  referral_id: string;
  ledger_entry_id: string | null;
  trade_amount: number;
  fee_amount: number;
  commission_amount: number;
  created_at: string;
}

export interface ReferralSettings {
  id: string;
  default_commission_percent: number;
  default_discount_percent: number;
  discount_duration_days: number;
  min_deposit_amount: number;
  is_active: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface ReferralStats {
  totalReferrals: number;
  activatedReferrals: number;
  pendingReferrals: number;
  totalCommissionEarned: number;
  referralCode: string | null;
}

export interface AdminReferralStats {
  totalCodes: number;
  totalActivated: number;
  conversionRate: number;
  totalCommissionsPaid: number;
}

export interface ReferralWithDetails extends Referral {
  referrer_email?: string;
  referred_email?: string;
}

export interface ActiveDiscount {
  hasDiscount: boolean;
  discountPercent: number;
  expiresAt: string | null;
  referralId: string;
}
