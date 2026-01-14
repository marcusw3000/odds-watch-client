export interface LeaderboardProfile {
  id: string;
  user_id: string;
  display_name: string;
  is_public: boolean;
  show_profit: boolean;
  show_roi: boolean;
  show_volume: boolean;
  show_trades: boolean;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStatistics {
  id: string;
  user_id: string;
  total_profit: number;
  total_volume: number;
  total_trades: number;
  winning_trades: number;
  roi_percent: number;
  best_trade_profit: number;
  current_streak: number;
  best_streak: number;
  updated_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  points: number;
  is_active: boolean;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  achievement?: Achievement;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  total_profit: number;
  roi_percent: number;
  total_volume: number;
  total_trades: number;
  winning_trades: number;
  show_profit: boolean;
  show_roi: boolean;
  show_volume: boolean;
  show_trades: boolean;
}

export type LeaderboardSortBy = 'profit' | 'roi' | 'volume' | 'trades';
export type LeaderboardPeriod = 'all' | 'month' | 'week';
