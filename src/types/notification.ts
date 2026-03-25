export type NotificationType = 
  | 'MARKET_CLOSING_SOON'
  | 'MARKET_HALTED'
  | 'MARKET_SETTLED'
  | 'TRADE_EXECUTED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'LEADERBOARD_RANK'
  | 'REFERRAL_ACTIVATED'
  | 'SYSTEM_ANNOUNCEMENT'
  | 'DEPOSIT_CONFIRMED'
  | 'WITHDRAWAL_COMPLETED'
  | 'WITHDRAWAL_FAILED'
  | 'WITHDRAWAL_REQUESTED'
  | 'PRICE_ALERT'
  | 'COMMENT_MENTION'
  | 'COMMENT_LIKE'
  | 'COMMENT_REPLY'
  | 'SUGGESTION_COMMENT_MENTION'
  | 'SUGGESTION_COMMENT_REPLY'
  | 'SUGGESTION_APPROVED'
  | 'SUGGESTION_REJECTED'
  | 'ADMIN_NEW_TICKET'
  | 'ADMIN_NEW_REPORT'
  | 'ADMIN_NEW_CONTESTATION'
  | 'USER_WARNING'
  | 'SUGGESTION_IMPLEMENTED'
  | 'SUPPORT_REPLY'
  | 'SUPPORT_TICKET_RESOLVED';

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
  in_app_social: boolean;
  email_market_settled: boolean;
  email_market_closing: boolean;
  email_weekly_summary: boolean;
  email_marketing: boolean;
  email_mentions: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
}
