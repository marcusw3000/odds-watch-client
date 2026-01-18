import { useState, useEffect } from 'react';
import { Palette, Check, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CARD_STYLES, CardStyleType } from '@/types/cardStyles';
import { useCardStyle } from '@/hooks/useCardStyle';
import { CompactMarketCard } from '@/components/market/CompactMarketCard';
import { MarketEvent } from '@/types/market';
import { cn } from '@/lib/utils';

// Mock event for preview
const mockEvent: MarketEvent = {
  id: 'preview-1',
  title: 'Taxa Selic será maior que 12% em Janeiro?',
  description: 'Previsão sobre a taxa básica de juros definida pelo Copom.',
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

export function AdminAppearancePage() {
  const { toast } = useToast();
  const { cardStyle, setCardStyle } = useCardStyle();
  const [selectedStyle, setSelectedStyle] = useState<CardStyleType>(cardStyle);
  const [previewStyle, setPreviewStyle] = useState<CardStyleType>(cardStyle);

  useEffect(() => {
    setSelectedStyle(cardStyle);
    setPreviewStyle(cardStyle);
  }, [cardStyle]);

  const handleSave = () => {
    setCardStyle(selectedStyle);
    toast({
      title: 'Configurações salvas',
      description: 'O estilo dos cards foi atualizado com sucesso.',
    });
  };

  const handlePreview = (style: CardStyleType) => {
    setPreviewStyle(style);
  };

  const hasChanges = selectedStyle !== cardStyle;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          Aparência Padrão
        </h1>
        <p className="text-muted-foreground mt-1">
          Estilo padrão para eventos que não têm estilo individual definido
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card Styles Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Estilo Padrão dos Cards</CardTitle>
            <CardDescription>
              Este estilo será usado quando um evento não tiver estilo individual configurado. 
              Você pode definir estilos individuais na tela de edição de cada evento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {CARD_STYLES.map((style) => (
              <div
                key={style.id}
                className={cn(
                  "relative flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  selectedStyle === style.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => {
                  setSelectedStyle(style.id);
                  handlePreview(style.id);
                }}
              >
                {selectedStyle === style.id && (
                  <div className="absolute top-3 right-3">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{style.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {style.description}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(style.id);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="pt-4 border-t">
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges}
                className="w-full"
              >
                {hasChanges ? 'Salvar Alterações' : 'Nenhuma alteração'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Pré-visualização
            </CardTitle>
            <CardDescription>
              Veja como o card ficará com o estilo selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-lg p-6">
              <div className="max-w-sm mx-auto">
                <CompactMarketCard
                  event={mockEvent}
                  onBuy={() => {}}
                  onViewDetails={() => {}}
                  styleOverride={previewStyle}
                />
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground text-center">
                Estilo atual: <span className="font-medium text-foreground">
                  {CARD_STYLES.find(s => s.id === previewStyle)?.name}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview em Grade</CardTitle>
          <CardDescription>
            Visualize como múltiplos cards aparecem lado a lado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-6">
            <div className={cn(
              "grid gap-4",
              previewStyle === 'minimal' 
                ? "grid-cols-1 sm:grid-cols-2" 
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            )}>
              {[
                { ...mockEvent, id: '1', title: 'Taxa Selic será maior que 12% em Janeiro?' },
                { ...mockEvent, id: '2', title: 'IPCA acumulado ultrapassará 5% no ano?', outcomes: { YES: { price: 42, probability: 42 }, NO: { price: 58, probability: 58 } } },
                { ...mockEvent, id: '3', title: 'Dólar fechará abaixo de R$5 em Fevereiro?', category: 'Câmbio', outcomes: { YES: { price: 28, probability: 28 }, NO: { price: 72, probability: 72 } } },
              ].map((event) => (
                <CompactMarketCard
                  key={event.id}
                  event={event as MarketEvent}
                  onBuy={() => {}}
                  onViewDetails={() => {}}
                  styleOverride={previewStyle}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
