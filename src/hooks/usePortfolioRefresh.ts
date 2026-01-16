import { useEffect, useCallback } from 'react';

// Custom event name for portfolio refresh
const PORTFOLIO_REFRESH_EVENT = 'portfolio:refresh';

/**
 * Dispatch a portfolio refresh event
 * Call this after successful purchases, sales, deposits, etc.
 */
export function triggerPortfolioRefresh() {
  window.dispatchEvent(new CustomEvent(PORTFOLIO_REFRESH_EVENT));
}

/**
 * Hook to listen for portfolio refresh events
 * @param callback Function to call when refresh is triggered
 */
export function usePortfolioRefreshListener(callback: () => void) {
  const stableCallback = useCallback(callback, [callback]);

  useEffect(() => {
    const handleRefresh = () => {
      stableCallback();
    };

    window.addEventListener(PORTFOLIO_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(PORTFOLIO_REFRESH_EVENT, handleRefresh);
    };
  }, [stableCallback]);
}
