import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

export function useViewportSkeletons(cardHeight = 280) {
  const calculateSkeletons = useCallback(() => {
    if (typeof window === 'undefined') return 8;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Cards per row based on Tailwind breakpoints
    // grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
    let cardsPerRow = 1;
    if (width >= 1280) cardsPerRow = 4;
    else if (width >= 1024) cardsPerRow = 3;
    else if (width >= 640) cardsPerRow = 2;
    
    // Available height for cards (approximately 60% of viewport after header/filters)
    const availableHeight = height * 0.6;
    const rowsVisible = Math.ceil(availableHeight / cardHeight);
    
    // Minimum 4, maximum 16
    return Math.max(4, Math.min(cardsPerRow * rowsVisible, 16));
  }, [cardHeight]);

  const [skeletonCount, setSkeletonCount] = useState(() => calculateSkeletons());

  useEffect(() => {
    const handleResize = () => {
      setSkeletonCount(calculateSkeletons());
    };

    // Initial calculation
    handleResize();

    // Debounced resize handler
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, [calculateSkeletons]);

  return skeletonCount;
}
