import { memo, useState, useMemo } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { useMarketStatus } from '@/hooks/useMarketStatus';
import { cn } from '@/lib/utils';

interface TrendingMarketCardProps {
  event: MarketEvent;
  onBuy: (eventId: string, outcome: 'YES' | 'NO') => void;
  onViewDetails?: (eventId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export const TrendingMarketCard = memo(function TrendingMarketCard({
  event,
  onBuy,
  onViewDetails,
  onPrev,
  onNext,
  currentIndex = 0,
  totalCount = 1,
}: TrendingMarketCardProps) {
  const statusInfo = useMarketStatus(event);
  const [isHovered, setIsHovered] = useState(false);

  const formatVolume = (vol?: number) => {
    if (!vol) return 'R$0';
    if (vol >= 1000000) return `R$${(vol / 1000000).toFixed(3).replace('.', ',')}`;
    if (vol >= 1000) return `R$${(vol / 1000).toFixed(0)}k`;
    return `R$${vol.toLocaleString('pt-BR')}`;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      Economia: '🏛️',
      Câmbio: '💱',
      Esportes: '⚽',
      Mercado: '📈',
      Política: '🗳️',
      'Política Monetária': '🏦',
      Inflação: '📊',
    };
    return icons[category] || '📊';
  };

  const hasImage = Boolean(event.imageUrl);

  // Generate mock price history data with dates
  const priceHistory = useMemo(() => {
    const createdAt = event.createdAt ? new Date(event.createdAt) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysDiff = Math.max(differenceInDays(now, createdAt), 1);
    const dataPoints = Math.min(Math.max(daysDiff * 6, 30), 80);
    
    const data = [];
    const currentYesPrice = event.outcomes.YES.price;
    const currentNoPrice = event.outcomes.NO.price;
    
    let yesPrice = 50;
    let noPrice = 50;
    const yesStep = (currentYesPrice - 50) / dataPoints;
    const noStep = (currentNoPrice - 50) / dataPoints;
    
    for (let i = 0; i <= dataPoints; i++) {
      const date = new Date(createdAt.getTime() + (i * (now.getTime() - createdAt.getTime()) / dataPoints));
      const randomVariation = (Math.random() - 0.5) * 6;
      
      yesPrice = Math.max(5, Math.min(95, yesPrice + yesStep + randomVariation));
      noPrice = 100 - yesPrice;
      
      data.push({
        date: format(date, "d 'de' MMM", { locale: ptBR }),
        fullDate: format(date, "d MMM, HH:mm", { locale: ptBR }),
        yes: Math.round(yesPrice),
        no: Math.round(noPrice),
      });
    }
    
    // Ensure last point matches current prices
    if (data.length > 0) {
      data[data.length - 1].yes = currentYesPrice;
      data[data.length - 1].no = currentNoPrice;
    }
    
    return data;
  }, [event.createdAt, event.outcomes.YES.price, event.outcomes.NO.price]);

  return (
    <div 
      className="relative overflow-hidden rounded-2xl border border-border bg-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left Side - Market Info */}
        <div className="p-6 flex flex-col">
          {/* Header with image and title */}
          <div className="flex items-start gap-4 mb-6">
            {/* Image/Icon */}
            {hasImage ? (
              <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden relative">
                <div
                  className={cn(
                    "absolute inset-0 bg-cover bg-center transition-transform duration-300 ease-out",
                    isHovered && "scale-110"
                  )}
                  style={{
                    backgroundImage: `url(${event.imageUrl})`,
                    backgroundPosition: event.imagePosition 
                      ? `${event.imagePosition.x}% ${event.imagePosition.y}%` 
                      : 'center',
                    transform: isHovered 
                      ? `scale(${(event.imageZoom || 1) * 1.1})` 
                      : `scale(${event.imageZoom || 1})`,
                  }}
                />
              </div>
            ) : (
              <div 
                className={cn(
                  "flex-shrink-0 w-14 h-14 rounded-lg bg-secondary flex items-center justify-center text-2xl transition-transform duration-300",
                  isHovered && "scale-105"
                )}
              >
                {getCategoryIcon(event.category)}
              </div>
            )}

            {/* Title */}
            <h2 
              className="flex-1 text-xl font-bold cursor-pointer hover:text-primary transition-colors"
              onClick={() => onViewDetails?.(event.id)}
            >
              {event.title}
            </h2>
          </div>

          {/* Outcome Rows */}
          <div className="space-y-3 mb-6">
            {/* YES Option */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sim</span>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold">{event.outcomes.YES.price}%</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs font-medium border-yes/40 hover:bg-yes/10 hover:text-yes hover:border-yes"
                    onClick={() => onBuy(event.id, 'YES')}
                    disabled={!statusInfo.canTrade}
                  >
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs font-medium border-no/40 hover:bg-no/10 hover:text-no hover:border-no"
                    onClick={() => onBuy(event.id, 'NO')}
                    disabled={!statusInfo.canTrade}
                  >
                    No
                  </Button>
                </div>
              </div>
            </div>

            {/* NO Option */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Não</span>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold">{event.outcomes.NO.price}%</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs font-medium border-yes/40 hover:bg-yes/10 hover:text-yes hover:border-yes"
                    onClick={() => onBuy(event.id, 'YES')}
                    disabled={!statusInfo.canTrade}
                  >
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs font-medium border-no/40 hover:bg-no/10 hover:text-no hover:border-no"
                    onClick={() => onBuy(event.id, 'NO')}
                    disabled={!statusInfo.canTrade}
                  >
                    No
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* News/Description */}
          {event.description && (
            <div className="mb-4">
              <span className="text-xs font-medium text-primary">Descrição</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground line-clamp-2">
                {event.description}
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>{formatVolume(event.volume)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onViewDetails?.(event.id)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right Side - Chart */}
        <div className="hidden lg:flex flex-col p-6 border-l border-border">
          {/* Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yes" />
              <span className="text-sm text-muted-foreground">Sim</span>
              <span className="text-sm font-bold">{event.outcomes.YES.price}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-no" />
              <span className="text-sm text-muted-foreground">Não</span>
              <span className="text-sm font-bold">{event.outcomes.NO.price}%</span>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory} margin={{ top: 5, right: 45, left: 0, bottom: 5 }}>
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={[20, 80]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value}%`}
                  orientation="right"
                  width={35}
                  ticks={[30, 45, 60, 75]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [
                    `${value}%`, 
                    name === 'yes' ? 'Sim' : 'Não'
                  ]}
                  labelFormatter={(_, payload) => {
                    if (payload && payload[0]) {
                      return payload[0].payload.fullDate;
                    }
                    return '';
                  }}
                />
                <Line
                  type="linear"
                  dataKey="yes"
                  stroke="hsl(var(--yes))"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: 'hsl(var(--yes))' }}
                />
                <Line
                  type="linear"
                  dataKey="no"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: 'hsl(var(--muted-foreground))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {totalCount > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={onPrev}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          
          {/* Dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalCount }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === currentIndex ? "bg-foreground" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={onNext}
          >
            <span className="hidden sm:inline">Próximo</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
});
