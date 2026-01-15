import { memo, useState, useMemo } from 'react';
import { TrendingUp, ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { MarketStatusBadge } from './MarketStatusBadge';
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
    if (vol >= 1000000) return `R$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `R$${(vol / 1000).toFixed(0)}k`;
    return `R$${vol}`;
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

  // Format time until event
  const getTimeUntil = () => {
    const now = new Date();
    const target = event.tradingHaltAt;
    const hours = differenceInHours(target, now);
    const minutes = differenceInMinutes(target, now) % 60;
    
    if (hours > 24) {
      const days = differenceInDays(target, now);
      return `${days}d`;
    }
    return `${hours}h ${minutes}m`;
  };

  const hasImage = Boolean(event.imageUrl);

  // Generate mock price history data
  const priceHistory = useMemo(() => {
    const createdAt = event.createdAt ? new Date(event.createdAt) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysDiff = Math.max(differenceInDays(now, createdAt), 1);
    const dataPoints = Math.min(Math.max(daysDiff * 4, 20), 50);
    
    const data = [];
    const currentYesPrice = event.outcomes.YES.price;
    const currentNoPrice = event.outcomes.NO.price;
    
    let yesPrice = 50;
    let noPrice = 50;
    const yesStep = (currentYesPrice - 50) / dataPoints;
    const noStep = (currentNoPrice - 50) / dataPoints;
    
    for (let i = 0; i <= dataPoints; i++) {
      const date = new Date(createdAt.getTime() + (i * (now.getTime() - createdAt.getTime()) / dataPoints));
      const randomVariation = (Math.random() - 0.5) * 8;
      
      yesPrice = Math.max(5, Math.min(95, yesPrice + yesStep + randomVariation));
      noPrice = 100 - yesPrice;
      
      data.push({
        time: format(date, 'HH:mm', { locale: ptBR }),
        date: format(date, 'd MMM', { locale: ptBR }),
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

  // Calculate potential payout
  const yesPayoutMultiplier = (100 / event.outcomes.YES.price).toFixed(1);
  const noPayoutMultiplier = (100 / event.outcomes.NO.price).toFixed(1);

  return (
    <div 
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left Side - Market Info */}
        <div className="p-6 lg:p-8 flex flex-col">
          {/* Header with image, category and countdown */}
          <div className="flex items-start gap-4 mb-4">
            {/* Image/Icon */}
            <div className="flex-shrink-0">
              {hasImage ? (
                <div className="w-16 h-16 rounded-xl overflow-hidden relative">
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
                    "w-16 h-16 rounded-xl bg-secondary flex items-center justify-center text-3xl transition-transform duration-300",
                    isHovered && "scale-105"
                  )}
                >
                  {getCategoryIcon(event.category)}
                </div>
              )}
            </div>

            {/* Category and Title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-muted-foreground">{event.category}</span>
              </div>
              <h2 
                className="text-xl lg:text-2xl font-bold cursor-pointer hover:text-primary transition-colors line-clamp-2"
                onClick={() => onViewDetails?.(event.id)}
              >
                {event.title}
              </h2>
            </div>

            {/* Countdown / Status */}
            <div className="flex-shrink-0 text-right">
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Encerra em {getTimeUntil()}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(event.tradingHaltAt, "d MMM, HH:mm", { locale: ptBR })}
              </div>
            </div>
          </div>

          {/* Outcome Buttons */}
          <div className="flex gap-3 mb-4">
            <Button
              className="flex-1 h-14 bg-yes/20 hover:bg-yes/30 border-2 border-yes text-yes font-bold text-lg"
              variant="outline"
              onClick={() => onBuy(event.id, 'YES')}
              disabled={!statusInfo.canTrade}
            >
              SIM {event.outcomes.YES.price}¢
            </Button>
            <Button
              className="flex-1 h-14 bg-no/20 hover:bg-no/30 border-2 border-no text-no font-bold text-lg"
              variant="outline"
              onClick={() => onBuy(event.id, 'NO')}
              disabled={!statusInfo.canTrade}
            >
              NÃO {event.outcomes.NO.price}¢
            </Button>
          </div>

          {/* Payout info */}
          <div className="flex gap-6 mb-4 text-sm">
            <div className="text-muted-foreground">
              R$1 → <span className="text-yes font-semibold">R${yesPayoutMultiplier}</span>
            </div>
            <div className="text-muted-foreground">
              R$1 → <span className="text-no font-semibold">R${noPayoutMultiplier}</span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-4">
              <span className="text-xs font-medium text-muted-foreground">Descrição</span>
              <p className="text-sm text-foreground mt-1 line-clamp-2">
                {event.description}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
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
        <div className="hidden lg:flex flex-col p-6 border-l border-border bg-secondary/5">
          {/* Chart Header */}
          <div className="flex justify-between items-center mb-4">
            <MarketStatusBadge
              status={statusInfo.status}
              timeToHalt={statusInfo.timeToHalt}
              result={event.result}
              size="sm"
              showCountdown={statusInfo.isUrgent}
              isUrgent={statusInfo.isUrgent}
            />
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-yes rounded" />
                <span className="text-muted-foreground">Sim</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-no rounded" />
                <span className="text-muted-foreground">Não</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="time" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value}%`}
                  orientation="right"
                  width={40}
                />
                <ReferenceLine y={50} stroke="hsl(var(--border))" strokeDasharray="3 3" />
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
                  labelFormatter={(label) => `Horário: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="yes"
                  stroke="hsl(var(--yes))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--yes))' }}
                />
                <Line
                  type="monotone"
                  dataKey="no"
                  stroke="hsl(var(--no))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--no))' }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Current price labels */}
            <div className="absolute right-0 top-1/4 flex flex-col gap-1">
              <div className="bg-yes text-yes-foreground px-2 py-0.5 rounded text-xs font-bold">
                Sim {event.outcomes.YES.price}%
              </div>
            </div>
            <div className="absolute right-0 bottom-1/4 flex flex-col gap-1">
              <div className="bg-no text-no-foreground px-2 py-0.5 rounded text-xs font-bold">
                Não {event.outcomes.NO.price}%
              </div>
            </div>
          </div>
          
          {/* Date range */}
          <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
            <span>{priceHistory[0]?.date}</span>
            <span>Agora</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {totalCount > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={onPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalCount }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={onNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
});
