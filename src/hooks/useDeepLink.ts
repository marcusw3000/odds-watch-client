import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface DeepLinkState {
  action: 'buy' | 'highlight' | null;
  outcome?: 'YES' | 'NO';
  highlightId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/**
 * Hook to handle deep link parameters from URL
 * Automatically triggers actions based on URL parameters
 */
export function useDeepLink() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deepLinkState, setDeepLinkState] = useState<DeepLinkState>({ action: null });

  useEffect(() => {
    const action = searchParams.get('action');
    const outcome = searchParams.get('outcome') as 'YES' | 'NO' | null;
    const highlight = searchParams.get('highlight');
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');

    const newState: DeepLinkState = { action: null };

    if (action === 'buy' && outcome) {
      newState.action = 'buy';
      newState.outcome = outcome;
    } else if (highlight) {
      newState.action = 'highlight';
      newState.highlightId = highlight;
    }

    if (utmSource) newState.utmSource = utmSource;
    if (utmMedium) newState.utmMedium = utmMedium;
    if (utmCampaign) newState.utmCampaign = utmCampaign;

    setDeepLinkState(newState);

    // Track deep link analytics (could integrate with analytics service)
    if (utmSource || utmMedium || utmCampaign) {
      console.log('Deep link accessed:', { utmSource, utmMedium, utmCampaign });
    }
  }, [searchParams]);

  /**
   * Clears the action parameters from URL after handling
   */
  const clearAction = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('action');
    newParams.delete('outcome');
    newParams.delete('highlight');
    setSearchParams(newParams, { replace: true });
    setDeepLinkState(prev => ({ ...prev, action: null }));
  };

  return {
    ...deepLinkState,
    clearAction,
    hasDeepLink: deepLinkState.action !== null,
  };
}
