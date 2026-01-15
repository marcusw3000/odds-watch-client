/**
 * Deep Links System
 * 
 * Generates and parses deep links for sharing markets, positions, and trades.
 * These links open the app directly to the relevant content.
 */

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export type DeepLinkType = 'market' | 'position' | 'trade' | 'referral' | 'leaderboard';

interface DeepLinkParams {
  type: DeepLinkType;
  id?: string;
  outcome?: 'YES' | 'NO';
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

/**
 * Generates a deep link URL with optional UTM parameters for tracking
 */
export function generateDeepLink(params: DeepLinkParams): string {
  const { type, id, outcome, ref, utm_source, utm_medium, utm_campaign } = params;
  
  let path = '';
  const queryParams = new URLSearchParams();
  
  switch (type) {
    case 'market':
      path = `/market/${id}`;
      if (outcome) queryParams.set('outcome', outcome);
      break;
    case 'position':
      path = `/portfolio`;
      if (id) queryParams.set('highlight', id);
      break;
    case 'trade':
      path = `/market/${id}`;
      if (outcome) queryParams.set('action', 'buy');
      if (outcome) queryParams.set('outcome', outcome);
      break;
    case 'referral':
      path = '/auth';
      if (ref) queryParams.set('ref', ref);
      break;
    case 'leaderboard':
      path = '/leaderboard';
      if (id) queryParams.set('user', id);
      break;
  }
  
  // Add UTM parameters for tracking
  if (utm_source) queryParams.set('utm_source', utm_source);
  if (utm_medium) queryParams.set('utm_medium', utm_medium);
  if (utm_campaign) queryParams.set('utm_campaign', utm_campaign);
  
  const queryString = queryParams.toString();
  return `${BASE_URL}${path}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Parses a deep link URL and extracts parameters
 */
export function parseDeepLink(url: string): DeepLinkParams | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;
    
    // Market detail page
    if (pathname.startsWith('/market/')) {
      const id = pathname.replace('/market/', '');
      const outcome = searchParams.get('outcome') as 'YES' | 'NO' | null;
      const action = searchParams.get('action');
      
      return {
        type: action === 'buy' ? 'trade' : 'market',
        id,
        outcome: outcome || undefined,
        utm_source: searchParams.get('utm_source') || undefined,
        utm_medium: searchParams.get('utm_medium') || undefined,
        utm_campaign: searchParams.get('utm_campaign') || undefined,
      };
    }
    
    // Portfolio with highlighted position
    if (pathname === '/portfolio') {
      const highlight = searchParams.get('highlight');
      return {
        type: 'position',
        id: highlight || undefined,
      };
    }
    
    // Auth with referral
    if (pathname === '/auth') {
      const ref = searchParams.get('ref');
      return {
        type: 'referral',
        ref: ref || undefined,
      };
    }
    
    // Leaderboard with user highlight
    if (pathname === '/leaderboard') {
      const user = searchParams.get('user');
      return {
        type: 'leaderboard',
        id: user || undefined,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates share links for different social platforms with deep links
 */
export function generateSocialShareLinks(params: {
  title: string;
  description?: string;
  deepLink: string;
  hashtags?: string[];
}) {
  const { title, description = '', deepLink, hashtags = [] } = params;
  const encodedUrl = encodeURIComponent(deepLink);
  const encodedText = encodeURIComponent(`${title}\n\n${description}`);
  const hashtagString = hashtags.map(h => h.replace('#', '')).join(',');
  
  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}${hashtagString ? `&hashtags=${hashtagString}` : ''}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title}\n${description}\n\n${deepLink}`)}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${description}\n\n${deepLink}`)}`,
  };
}

/**
 * Generates a market share deep link with tracking
 */
export function generateMarketShareLink(marketId: string, options?: {
  outcome?: 'YES' | 'NO';
  source?: 'twitter' | 'facebook' | 'whatsapp' | 'telegram' | 'copy';
}): string {
  return generateDeepLink({
    type: 'market',
    id: marketId,
    outcome: options?.outcome,
    utm_source: options?.source || 'share',
    utm_medium: 'social',
    utm_campaign: 'market_share',
  });
}

/**
 * Generates a trade invitation deep link
 */
export function generateTradeInviteLink(marketId: string, outcome: 'YES' | 'NO', source?: string): string {
  return generateDeepLink({
    type: 'trade',
    id: marketId,
    outcome,
    utm_source: source || 'invite',
    utm_medium: 'social',
    utm_campaign: 'trade_invite',
  });
}

/**
 * Generates a position share deep link
 */
export function generatePositionShareLink(positionId: string): string {
  return generateDeepLink({
    type: 'position',
    id: positionId,
    utm_source: 'share',
    utm_medium: 'social',
    utm_campaign: 'position_share',
  });
}

/**
 * Hook to handle deep link navigation on app load
 */
export function getDeepLinkAction(): { 
  action: 'buy' | 'highlight' | null; 
  outcome?: 'YES' | 'NO';
  highlightId?: string;
} {
  if (typeof window === 'undefined') return { action: null };
  
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const outcome = params.get('outcome') as 'YES' | 'NO' | null;
  const highlight = params.get('highlight');
  
  if (action === 'buy' && outcome) {
    return { action: 'buy', outcome };
  }
  
  if (highlight) {
    return { action: 'highlight', highlightId: highlight };
  }
  
  return { action: null };
}
