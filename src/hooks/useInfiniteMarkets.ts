import { useState, useCallback, useEffect, useRef } from 'react';
import { MarketEvent } from '@/types/market';

interface UseInfiniteMarketsOptions {
  pageSize?: number;
  allEvents: MarketEvent[];
}

export function useInfiniteMarkets({ pageSize = 12, allEvents }: UseInfiniteMarketsOptions) {
  const [displayedCount, setDisplayedCount] = useState(pageSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const displayedEvents = allEvents.slice(0, displayedCount);
  const hasMore = displayedCount < allEvents.length;

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    // Small delay for smooth UX
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + pageSize, allEvents.length));
      setIsLoadingMore(false);
    }, 150);
  }, [isLoadingMore, hasMore, pageSize, allEvents.length]);

  const reset = useCallback(() => {
    setDisplayedCount(pageSize);
  }, [pageSize]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [loadMore, hasMore, isLoadingMore]);

  // Reset when allEvents changes (filters applied)
  useEffect(() => {
    setDisplayedCount(pageSize);
  }, [allEvents, pageSize]);

  return {
    displayedEvents,
    hasMore,
    isLoadingMore,
    loadMoreRef,
    loadMore,
    reset,
    totalCount: allEvents.length,
    displayedCount: displayedEvents.length,
  };
}
