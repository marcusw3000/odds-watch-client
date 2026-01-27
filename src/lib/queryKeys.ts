/**
 * Centralized React Query key definitions
 * Prevents typos and enables easy refactoring
 */

export const queryKeys = {
  // User data
  favorites: (userId?: string) => ['favorites', userId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  notificationPreferences: (userId?: string) => ['notification-preferences', userId] as const,
  
  // Payments
  payments: (userId?: string) => ['payments', userId] as const,
  pendingPayments: (userId?: string) => ['pending-payments', userId] as const,
  userBalance: () => ['user-balance'] as const,
  savedCards: () => ['saved-cards'] as const,
  
  // Portfolio
  portfolio: {
    balance: ['portfolio', 'balance'] as const,
    user: (userId?: string) => ['portfolio', userId] as const,
    contracts: (userId?: string) => ['portfolio', 'contracts', userId] as const,
  },
  contracts: (userId?: string) => ['contracts', userId] as const,
  
  // Markets
  markets: (filters?: Record<string, unknown>) => ['markets', filters] as const,
  infiniteMarkets: (filters: Record<string, unknown>) => ['infinite-markets', filters] as const,
  market: (id: string) => ['market', id] as const,
  marketComments: (id: string) => ['market-comments', id] as const,
  
  // Leaderboard
  leaderboard: () => ['leaderboard'] as const,
  myLeaderboardProfile: () => ['my-leaderboard-profile'] as const,
  publicProfile: (userId: string) => ['public-profile', userId] as const,
  userDisplayInfo: (userId?: string) => ['user-display-info', userId] as const,
  userDisplayInfoBatch: (userIds: string[]) => ['user-display-info-batch', ...userIds] as const,
  
  // Support
  supportTickets: () => ['support-tickets'] as const,
  ticketMessages: (ticketId: string) => ['ticket-messages', ticketId] as const,
  
  // Suggestions
  suggestions: (filters?: Record<string, unknown>) => ['suggestions', filters] as const,
  suggestion: (id: string) => ['suggestion', id] as const,
  suggestionComments: (id: string) => ['suggestion-comments', id] as const,
  suggestionVotes: (ids?: string[]) => ['suggestion-votes', ids] as const,
  
  // Copy Trade
  copyTraders: () => ['copy-traders'] as const,
  approvedCopyTraders: () => ['approved-copy-traders'] as const,
  mySubscriptions: () => ['my-subscriptions'] as const,
  myTraderStatus: () => ['my-trader-status'] as const,
  
  // Referrals
  referrals: (userId?: string) => ['referrals', userId] as const,
  referralCode: (userId?: string) => ['referral-code', userId] as const,
  referralStats: (userId?: string) => ['referral-stats', userId] as const,
  
  // Admin
  admin: {
    users: (filters?: Record<string, unknown>) => ['admin-users', filters] as const,
    userDetails: (userId: string) => ['admin-user-details', userId] as const,
    ledger: (filters?: Record<string, unknown>) => ['admin-ledger', filters] as const,
    events: (filters?: Record<string, unknown>) => ['admin-events', filters] as const,
    event: (id: string) => ['admin-event', id] as const,
    supportTickets: () => ['admin-support-tickets'] as const,
    suggestions: () => ['admin-suggestions'] as const,
    referrals: () => ['admin-referrals'] as const,
    copyTraders: () => ['admin-copy-traders'] as const,
    copyTradeSettings: () => ['admin-copy-trade-settings'] as const,
    dashboardMetrics: () => ['admin-dashboard-metrics'] as const,
    notifications: () => ['admin-notifications'] as const,
    auditLogs: (filters?: Record<string, unknown>) => ['admin-audit-logs', filters] as const,
  },
  
  // Secure data (admin)
  secure: {
    balance: () => ['secure-balance'] as const,
    portfolio: () => ['secure-portfolio'] as const,
    leaderboard: () => ['secure-leaderboard'] as const,
  },

  // Card style preferences
  cardStyle: () => ['card-style'] as const,
  
  // Data integrity
  dataIntegrity: () => ['data-integrity'] as const,
} as const;

// Type helper for extracting query key types
export type QueryKeys = typeof queryKeys;
