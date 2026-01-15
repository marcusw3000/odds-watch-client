import { useState, useEffect, useCallback } from 'react';
import { CardStyleType, DEFAULT_CARD_STYLE } from '@/types/cardStyles';

const STORAGE_KEY = 'market-card-style';

export function useCardStyle() {
  const [cardStyle, setCardStyleState] = useState<CardStyleType>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ['default', 'buttons', 'simple', 'minimal'].includes(stored)) {
        return stored as CardStyleType;
      }
    }
    return DEFAULT_CARD_STYLE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, cardStyle);
  }, [cardStyle]);

  const setCardStyle = useCallback((style: CardStyleType) => {
    setCardStyleState(style);
  }, []);

  return { cardStyle, setCardStyle };
}

// Singleton for global access
let globalCardStyle: CardStyleType = DEFAULT_CARD_STYLE;

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ['default', 'buttons', 'simple', 'minimal'].includes(stored)) {
    globalCardStyle = stored as CardStyleType;
  }
}

export function getCardStyle(): CardStyleType {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['default', 'buttons', 'simple', 'minimal'].includes(stored)) {
      return stored as CardStyleType;
    }
  }
  return DEFAULT_CARD_STYLE;
}
