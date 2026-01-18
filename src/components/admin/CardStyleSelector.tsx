import { memo } from 'react';
import { Check, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CARD_STYLES, CardStyleType } from '@/types/cardStyles';
import { CompactMarketCard } from '@/components/market/CompactMarketCard';
import { MarketEvent } from '@/types/market';
import { cn } from '@/lib/utils';

interface CardStyleSelectorProps {
  value: CardStyleType;
  onChange: (style: CardStyleType) => void;
  previewEvent?: Partial<MarketEvent>;
  disabled?: boolean;
}

// Default preview event
const defaultPreviewEvent: MarketEvent = {
  id: 'preview-1',
  title: 'Exemplo: Taxa Selic será maior que 12%?',
  description: 'Previsão sobre a taxa básica de juros.',
  category: 'Economia',
  status: 'OPEN',
  expiryAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  lastUpdatedAt: new Date(),
  outcomes: {
    YES: { price: 65, probability: 65 },
    NO: { price: 35, probability: 35 },
  },
  limits: { minBuy: 1, maxBuy: 1000 },
  volume: 125000,
  marketType: 'BINARY',
  optionsExclusive: true,
  tradingHaltAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
  eventAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  contractUnitCost: 100,
  lmsr: { b: 100, qYes: 0, qNo: 0 },
};

export const CardStyleSelector = memo(function CardStyleSelector({
  value,
  onChange,
  previewEvent,
  disabled = false,
}: CardStyleSelectorProps) {
  // Merge preview event with defaults
  const event: MarketEvent = {
    ...defaultPreviewEvent,
    ...previewEvent,
    id: previewEvent?.id || defaultPreviewEvent.id,
    outcomes: previewEvent?.outcomes || defaultPreviewEvent.outcomes,
    limits: previewEvent?.limits || defaultPreviewEvent.limits,
    lmsr: previewEvent?.lmsr || defaultPreviewEvent.lmsr,
  } as MarketEvent;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Aparência do Card
        </CardTitle>
        <CardDescription>
          Escolha como este evento será exibido na página de mercados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Style Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARD_STYLES.map((style) => (
            <div
              key={style.id}
              className={cn(
                "relative flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                value === style.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !disabled && onChange(style.id)}
            >
              {value === style.id && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm">{style.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {style.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-3">Pré-visualização:</p>
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="max-w-sm mx-auto">
              <CompactMarketCard
                event={event}
                onBuy={() => {}}
                onViewDetails={() => {}}
                styleOverride={value}
              />
            </div>
          </div>
        </div>

        {/* Current style label */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Estilo selecionado: <span className="font-medium text-foreground">
              {CARD_STYLES.find(s => s.id === value)?.name}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
});
