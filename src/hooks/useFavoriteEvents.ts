import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'admin-favorite-events';

export function useFavoriteEvents() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading favorites:', e);
    }
    return new Set();
  });

  // Persist to localStorage whenever favorites change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch (e) {
      console.error('Error saving favorites:', e);
    }
  }, [favorites]);

  const toggleFavorite = useCallback((eventId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((eventId: string) => {
    return favorites.has(eventId);
  }, [favorites]);

  const clearFavorites = useCallback(() => {
    setFavorites(new Set());
  }, []);

  return {
    favorites,
    favoritesList: [...favorites],
    toggleFavorite,
    isFavorite,
    clearFavorites,
    count: favorites.size,
  };
}
