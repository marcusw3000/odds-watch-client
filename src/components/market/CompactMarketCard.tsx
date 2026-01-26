import { memo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MarketEvent } from '@/types/market';
import { CardStyleType } from '@/types/cardStyles';
import { getCardStyle } from '@/hooks/useCardStyle';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { queryKeys } from '@/lib/queryKeys';
import { CardStyleDefault, CardStyleButtons, CardStyleSimple, CardStyleMinimal } from './cards';

interface CompactMarketCardProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
  styleOverride?: CardStyleType;
}

export const CompactMarketCard = memo(function CompactMarketCard({
  event,
  onBuy,
  onViewDetails,
  styleOverride,
}: CompactMarketCardProps) {
  // Priority: styleOverride (prop) > event.cardStyle (individual) > getCardStyle() (global)
  const cardStyle = styleOverride || event.cardStyle || getCardStyle();
  const queryClient = useQueryClient();

  // Prefetch market details on hover for instant navigation
  const handleMouseEnter = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.market(event.id),
      queryFn: () => MarketDataProvider.getEventById(event.id),
      staleTime: 60000, // Consider fresh for 1 minute
    });
  }, [queryClient, event.id]);

  const commonProps = { 
    event, 
    onBuy, 
    onViewDetails,
    onMouseEnter: handleMouseEnter,
  };

  switch (cardStyle) {
    case 'buttons':
      return <CardStyleButtons {...commonProps} />;
    case 'simple':
      return <CardStyleSimple {...commonProps} />;
    case 'minimal':
      return <CardStyleMinimal {...commonProps} />;
    case 'default':
    default:
      return <CardStyleDefault {...commonProps} />;
  }
});
