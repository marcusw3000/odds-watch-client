import { memo } from 'react';
import { MarketEvent } from '@/types/market';
import { CardStyleType } from '@/types/cardStyles';
import { getCardStyle } from '@/hooks/useCardStyle';
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
  const cardStyle = styleOverride || getCardStyle();

  const commonProps = { event, onBuy, onViewDetails };

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
