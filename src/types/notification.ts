export type NotificationType = 
  | 'MARKET_CLOSING_SOON'
  | 'MARKET_HALTED'
  | 'MARKET_SETTLED'
  | 'TRADE_EXECUTED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'LEADERBOARD_RANK'
  | 'REFERRAL_ACTIVATED'
  | 'SYSTEM_ANNOUNCEMENT';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  email_sent: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  in_app_market_updates: boolean;
  in_app_trade_updates: boolean;
  in_app_achievements: boolean;
  in_app_system: boolean;
  email_market_settled: boolean;
  email_market_closing: boolean;
  email_weekly_summary: boolean;
  email_marketing: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
}
