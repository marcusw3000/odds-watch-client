import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const BALANCE_CACHE_PREFIX = 'ow_balance_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CachedBalance {
  value: number;
  timestamp: number;
}

/**
 * Hook para gerenciar cache local do saldo do usuário
 * Implementa estratégia stale-while-revalidate para UX instantâneo
 */
export function useCachedBalance() {
  const { user } = useAuth();
  const [cachedValue, setCachedValue] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);

  const cacheKey = user ? `${BALANCE_CACHE_PREFIX}${user.id}` : null;

  // Load from cache on mount
  useEffect(() => {
    if (!cacheKey) {
      setCachedValue(null);
      return;
    }

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { value, timestamp }: CachedBalance = JSON.parse(cached);
        setCachedValue(value);
        setIsStale(Date.now() - timestamp > CACHE_TTL_MS);
      }
    } catch {
      // Invalid cache, ignore
    }
  }, [cacheKey]);

  // Save to cache
  const updateCache = useCallback((value: number) => {
    if (!cacheKey) return;
    
    const cacheData: CachedBalance = {
      value,
      timestamp: Date.now(),
    };
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      setCachedValue(value);
      setIsStale(false);
    } catch {
      // Storage full or unavailable
    }
  }, [cacheKey]);

  // Clear cache (on logout)
  const clearCache = useCallback(() => {
    if (cacheKey) {
      localStorage.removeItem(cacheKey);
      setCachedValue(null);
    }
  }, [cacheKey]);

  // Clear all balance caches (utility)
  const clearAllCaches = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(BALANCE_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
      // Storage unavailable
    }
  }, []);

  return {
    cachedBalance: cachedValue,
    isStale,
    updateCache,
    clearCache,
    clearAllCaches,
  };
}
