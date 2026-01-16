import { useState, useCallback, useMemo } from 'react';
import { MarketEvent, MarketStatus } from '@/types/market';
import isEqual from 'lodash.isequal';

export interface MarketFilters {
  categories: string[];
  statuses: MarketStatus[];
  volumeRange: [number, number];
  probabilityRange: [number, number];
  sortBy: 'volume' | 'created' | 'closing' | 'probability';
  sortOrder: 'asc' | 'desc';
  showFavoritesOnly: boolean;
  tags: string[];
}

const DEFAULT_FILTERS: MarketFilters = {
  categories: [],
  statuses: [],
  volumeRange: [0, Infinity],
  probabilityRange: [0, 100],
  sortBy: 'volume',
  sortOrder: 'desc',
  showFavoritesOnly: false,
  tags: [],
};

export function useMarketFilters(favoriteIds: string[] = []) {
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS);

  const updateFilter = useCallback(<K extends keyof MarketFilters>(
    key: K,
    value: MarketFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return !isEqual(filters, DEFAULT_FILTERS);
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.volumeRange[0] > 0 || filters.volumeRange[1] < Infinity) count++;
    if (filters.probabilityRange[0] > 0 || filters.probabilityRange[1] < 100) count++;
    if (filters.showFavoritesOnly) count++;
    if (filters.tags.length > 0) count++;
    return count;
  }, [filters]);

  const applyFilters = useCallback(
    (events: MarketEvent[]): MarketEvent[] => {
      let filtered = [...events];

      // Filter by favorites
      if (filters.showFavoritesOnly) {
        filtered = filtered.filter((e) => favoriteIds.includes(e.id));
      }

      // Filter by categories
      if (filters.categories.length > 0) {
        filtered = filtered.filter((e) => filters.categories.includes(e.category));
      }

      // Filter by status
      if (filters.statuses.length > 0) {
        filtered = filtered.filter((e) => filters.statuses.includes(e.status));
      }

      // Filter by volume range
      if (filters.volumeRange[0] > 0 || filters.volumeRange[1] < Infinity) {
        filtered = filtered.filter((e) => {
          const vol = e.volume || 0;
          return vol >= filters.volumeRange[0] && vol <= filters.volumeRange[1];
        });
      }

      // Filter by probability range (YES probability)
      if (filters.probabilityRange[0] > 0 || filters.probabilityRange[1] < 100) {
        filtered = filtered.filter((e) => {
          const prob = e.outcomes.YES.probability;
          return prob >= filters.probabilityRange[0] && prob <= filters.probabilityRange[1];
        });
      }

      // Filter by tags
      if (filters.tags.length > 0) {
        filtered = filtered.filter((e) =>
          e.tags?.some((tag) => filters.tags.includes(tag))
        );
      }

      // Sort
      filtered.sort((a, b) => {
        let comparison = 0;

        switch (filters.sortBy) {
          case 'volume':
            comparison = (b.volume || 0) - (a.volume || 0);
            break;
          case 'created':
            comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            break;
          case 'closing':
            comparison = new Date(a.tradingHaltAt).getTime() - new Date(b.tradingHaltAt).getTime();
            break;
          case 'probability':
            comparison = b.outcomes.YES.probability - a.outcomes.YES.probability;
            break;
        }

        return filters.sortOrder === 'asc' ? -comparison : comparison;
      });

      return filtered;
    },
    [filters, favoriteIds]
  );

  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
  };
}
