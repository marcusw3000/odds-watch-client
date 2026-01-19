// Maps achievement codes to their progress calculation logic
export interface UserStats {
  total_trades: number;
  total_profit: number;
  total_volume: number;
  winning_trades: number;
  best_streak: number;
  current_streak: number;
  roi_percent: number;
  best_trade_profit: number;
}

export interface AchievementProgress {
  current: number;
  target: number;
  percent: number;
  metricLabel: string;
}

// Extended stats to include new achievement fields
export interface ExtendedUserStats extends UserStats {
  markets_won_streak?: number;
  best_markets_won_streak?: number;
  has_night_trade?: boolean;
  has_early_trade?: boolean;
  weekend_trades?: number;
  has_speed_trade?: boolean;
  has_contrarian_trade?: boolean;
  total_referrals?: number;
  activated_referrals?: number;
  total_referral_commission?: number;
}

// Achievement code patterns and their targets
const achievementTargets: Record<string, { 
  metric: keyof ExtendedUserStats; 
  target: number; 
  label: string;
  isBool?: boolean;
}> = {
  // Trading achievements
  'first_trade': { metric: 'total_trades', target: 1, label: 'trade' },
  'trades_10': { metric: 'total_trades', target: 10, label: 'trades' },
  '10_trades': { metric: 'total_trades', target: 10, label: 'trades' },
  'trades_50': { metric: 'total_trades', target: 50, label: 'trades' },
  '50_trades': { metric: 'total_trades', target: 50, label: 'trades' },
  'trades_100': { metric: 'total_trades', target: 100, label: 'trades' },
  '100_trades': { metric: 'total_trades', target: 100, label: 'trades' },
  'trades_500': { metric: 'total_trades', target: 500, label: 'trades' },
  '500_trades': { metric: 'total_trades', target: 500, label: 'trades' },
  'trades_1000': { metric: 'total_trades', target: 1000, label: 'trades' },
  
  // Profit achievements
  'first_profit': { metric: 'total_profit', target: 1, label: 'de lucro' },
  'profit_100': { metric: 'total_profit', target: 100, label: 'de lucro' },
  'profit_1000': { metric: 'total_profit', target: 1000, label: 'de lucro' },
  'profit_10000': { metric: 'total_profit', target: 10000, label: 'de lucro' },
  'profit_100000': { metric: 'total_profit', target: 100000, label: 'de lucro' },
  
  // Streak achievements
  'streak_3': { metric: 'best_streak', target: 3, label: 'vitórias seguidas' },
  'win_streak_3': { metric: 'best_streak', target: 3, label: 'vitórias seguidas' },
  'streak_5': { metric: 'best_streak', target: 5, label: 'vitórias seguidas' },
  'win_streak_5': { metric: 'best_streak', target: 5, label: 'vitórias seguidas' },
  'streak_10': { metric: 'best_streak', target: 10, label: 'vitórias seguidas' },
  'win_streak_10': { metric: 'best_streak', target: 10, label: 'vitórias seguidas' },
  'streak_20': { metric: 'best_streak', target: 20, label: 'vitórias seguidas' },
  
  // Volume achievements
  'volume_1000': { metric: 'total_volume', target: 1000, label: 'de volume' },
  'volume_10000': { metric: 'total_volume', target: 10000, label: 'de volume' },
  'volume_100000': { metric: 'total_volume', target: 100000, label: 'de volume' },
  'volume_1000000': { metric: 'total_volume', target: 1000000, label: 'de volume' },
  
  // Win rate achievements
  'wins_10': { metric: 'winning_trades', target: 10, label: 'trades vencedores' },
  'wins_50': { metric: 'winning_trades', target: 50, label: 'trades vencedores' },
  'wins_100': { metric: 'winning_trades', target: 100, label: 'trades vencedores' },
  
  // ROI achievements
  'roi_10': { metric: 'roi_percent', target: 10, label: '% ROI' },
  'roi_50': { metric: 'roi_percent', target: 50, label: '% ROI' },
  'roi_100': { metric: 'roi_percent', target: 100, label: '% ROI' },
  
  // Prophet achievements (markets won streak)
  'prophet_3': { metric: 'best_markets_won_streak', target: 3, label: 'mercados acertados' },
  'prophet_5': { metric: 'best_markets_won_streak', target: 5, label: 'mercados acertados' },
  'prophet_10': { metric: 'best_markets_won_streak', target: 10, label: 'mercados acertados' },
  
  // Special time-based achievements
  'night_owl': { metric: 'has_night_trade', target: 1, label: 'trade noturno', isBool: true },
  'early_bird': { metric: 'has_early_trade', target: 1, label: 'trade matinal', isBool: true },
  'weekend_warrior': { metric: 'weekend_trades', target: 10, label: 'trades no fim de semana' },
  'speed_trader': { metric: 'has_speed_trade', target: 1, label: 'trade rápido', isBool: true },
  'contrarian': { metric: 'has_contrarian_trade', target: 1, label: 'trade contrarian', isBool: true },
  
  // Referral achievements
  'referral_first': { metric: 'total_referrals', target: 1, label: 'indicação' },
  'referral_5': { metric: 'total_referrals', target: 5, label: 'indicações' },
  'referral_10': { metric: 'total_referrals', target: 10, label: 'indicações' },
  'referral_25': { metric: 'total_referrals', target: 25, label: 'indicações' },
  'referral_activated_5': { metric: 'activated_referrals', target: 5, label: 'indicados ativos' },
  'referral_earnings_100': { metric: 'total_referral_commission', target: 100, label: 'em comissões' },
  'referral_earnings_500': { metric: 'total_referral_commission', target: 500, label: 'em comissões' },
  'referral_earnings_1000': { metric: 'total_referral_commission', target: 1000, label: 'em comissões' },
};

export function getAchievementProgress(
  code: string,
  stats: ExtendedUserStats | UserStats | null
): AchievementProgress {
  // Default for users without stats
  if (!stats) {
    return { current: 0, target: 1, percent: 0, metricLabel: '' };
  }

  // Try exact match first
  let config = achievementTargets[code];
  
  // Try pattern matching if no exact match
  if (!config) {
    // Extract numbers from code
    const numberMatch = code.match(/(\d+)/);
    const number = numberMatch ? parseInt(numberMatch[1]) : null;
    
    if (code.includes('trade')) {
      config = { metric: 'total_trades', target: number || 1, label: 'trades' };
    } else if (code.includes('profit') || code.includes('lucro')) {
      config = { metric: 'total_profit', target: number || 1, label: 'de lucro' };
    } else if (code.includes('streak') || code.includes('sequencia')) {
      config = { metric: 'best_streak', target: number || 1, label: 'vitórias seguidas' };
    } else if (code.includes('volume')) {
      config = { metric: 'total_volume', target: number || 1000, label: 'de volume' };
    } else if (code.includes('win')) {
      config = { metric: 'winning_trades', target: number || 1, label: 'trades vencedores' };
    } else if (code.includes('roi')) {
      config = { metric: 'roi_percent', target: number || 10, label: '% ROI' };
    } else if (code.includes('prophet')) {
      config = { metric: 'best_markets_won_streak', target: number || 3, label: 'mercados acertados' };
    } else if (code.includes('referral')) {
      config = { metric: 'total_referrals', target: number || 1, label: 'indicações' };
    }
  }

  // If still no config, return unknown progress
  if (!config) {
    return { current: 0, target: 1, percent: 0, metricLabel: 'progresso' };
  }

  // Handle boolean metrics
  if (config.isBool) {
    const boolValue = (stats as ExtendedUserStats)[config.metric as keyof ExtendedUserStats];
    const current = boolValue === true ? 1 : 0;
    return {
      current,
      target: 1,
      percent: current * 100,
      metricLabel: config.label,
    };
  }

  const extStats = stats as ExtendedUserStats;
  const current = Math.max(0, Number(extStats[config.metric]) || 0);
  const target = config.target;
  const percent = Math.min(100, Math.round((current / target) * 100));

  return {
    current,
    target,
    percent,
    metricLabel: config.label,
  };
}

export function formatProgressValue(value: number, metricLabel: string): string {
  if (metricLabel.includes('lucro') || metricLabel.includes('volume')) {
    return `R$ ${(Math.round(value * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (metricLabel.includes('ROI')) {
    return `${value.toFixed(2)}%`;
  }
  return value.toLocaleString('pt-BR');
}
