// Unified profile with leaderboard and statistics data
export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
  show_profit: boolean;
  show_roi: boolean;
  show_volume: boolean;
  show_trades: boolean;
  total_profit: number;
  roi_percent: number;
  total_volume: number;
  total_trades: number;
  winning_trades: number;
  current_streak: number;
  best_streak: number;
  best_trade_profit: number;
  created_at: string;
  updated_at: string;
}

// Legacy type aliases for backward compatibility
export type LeaderboardProfile = Pick<UserProfile, 
  'id' | 'display_name' | 'is_public' | 'show_profit' | 'show_roi' | 
  'show_volume' | 'show_trades' | 'bio' | 'created_at' | 'updated_at'
> & { user_id: string };

export type UserStatistics = Pick<UserProfile,
  'id' | 'total_profit' | 'total_volume' | 'total_trades' | 'winning_trades' |
  'roi_percent' | 'best_trade_profit' | 'current_streak' | 'best_streak' | 'updated_at'
> & { user_id: string };

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
