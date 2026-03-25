import { useMemo, useState } from 'react';
import { format, subHours, subDays, subWeeks, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { OddsHistoryPoint, MultiOptionHistoryPoint, MarketOption } from '@/types/market';
import { cn } from '@/lib/utils';

// Color palette for multi-option lines
const OPTION_COLORS = [
  'hsl(220, 90%, 56%)',   // blue
  'hsl(340, 82%, 52%)',   // rose
  'hsl(142, 71%, 45%)',   // green
  'hsl(38, 92%, 50%)',    // amber
  'hsl(270, 76%, 55%)',   // purple
  'hsl(190, 90%, 45%)',   // cyan
  'hsl(15, 85%, 55%)',    // orange
  'hsl(330, 65%, 50%)',   // pink
];

type TimeFilter = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: '1H', label: '1H' },
  { key: '6H', label: '6H' },
  { key: '1D', label: '1D' },
  { key: '1W', label: '1S' },
  { key: '1M', label: '1M' },
  { key: 'ALL', label: 'Tudo' },
];

function getFilterCutoff(filter: TimeFilter): Date | null {
  const now = new Date();
  switch (filter) {
    case '1H': return subHours(now, 1);
    case '6H': return subHours(now, 6);
    case '1D': return subDays(now, 1);
    case '1W': return subWeeks(now, 1);
    case '1M': return subMonths(now, 1);
    case 'ALL': return null;
  }
}

interface OddsChartProps {
  data: OddsHistoryPoint[];
  multiData?: MultiOptionHistoryPoint[];
  options?: MarketOption[];
}

export function OddsChart({ data, multiData, options }: OddsChartProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const isMulti = multiData && multiData.length > 0 && options && options.length > 0;

  const chartData = useMemo(() => {
    const cutoff = getFilterCutoff(timeFilter);

    if (isMulti) {
      const filtered = cutoff
        ? multiData.filter(p => p.timestamp >= cutoff)
        : multiData;

      return filtered.map((point) => {
        const entry: Record<string, string | number> = {
          date: format(point.timestamp, 'dd/MM HH:mm', { locale: ptBR }),
          fullDate: format(point.timestamp, "dd MMM yyyy HH:mm", { locale: ptBR }),
        };
        options!.forEach((opt) => {
          entry[opt.id] = point.prices[opt.id] ?? 0;
        });
        return entry;
      });
    }

    const filtered = cutoff
      ? data.filter(p => p.timestamp >= cutoff)
      : data;

    return filtered.map((point) => ({
      date: format(point.timestamp, 'dd/MM', { locale: ptBR }),
      fullDate: format(point.timestamp, "dd MMM yyyy", { locale: ptBR }),
      yes: point.yesPrice,
      no: point.noPrice,
    }));
  }, [data, multiData, options, timeFilter, isMulti]);

  return (
    <div className="space-y-3">
      {/* Time filter buttons */}
      <div className="flex gap-1">
        {TIME_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTimeFilter(f.key)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              timeFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="h-[300px] w-full" style={{ contain: 'layout style' }}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {isMulti ? (
                options!.map((opt, i) => (
                  <linearGradient key={opt.id} id={`gradient-${opt.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={OPTION_COLORS[i % OPTION_COLORS.length]} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={OPTION_COLORS[i % OPTION_COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))
              ) : (
                <>
                  <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--yes))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--yes))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="noGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--no))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--no))" stopOpacity={0} />
                  </linearGradient>
                </>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                    <p className="text-xs text-muted-foreground mb-2">{d.fullDate}</p>
                    <div className="space-y-1">
                      {isMulti ? (
                        options!.map((opt, i) => (
                          <div key={opt.id} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] }}
                              />
                              <span className="text-sm font-medium truncate max-w-[120px]">{opt.label}</span>
                            </div>
                            <span className="font-mono text-sm">{Math.round(d[opt.id] ?? 0)}%</span>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-yes">SIM</span>
                            <span className="font-mono text-sm">R${(d.yes / 100).toFixed(2)} ({d.yes}%)</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-no">NÃO</span>
                            <span className="font-mono text-sm">R${(d.no / 100).toFixed(2)} ({d.no}%)</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            {isMulti ? (
              options!.map((opt, i) => (
                <Area
                  key={opt.id}
                  type="monotone"
                  dataKey={opt.id}
                  stroke={OPTION_COLORS[i % OPTION_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#gradient-${opt.id})`}
                  name={opt.label}
                  isAnimationActive={false}
                />
              ))
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="yes"
                  stroke="hsl(var(--yes))"
                  strokeWidth={2}
                  fill="url(#yesGradient)"
                  name="SIM"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="no"
                  stroke="hsl(var(--no))"
                  strokeWidth={2}
                  fill="url(#noGradient)"
                  name="NÃO"
                  isAnimationActive={false}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend for multi-option */}
      {isMulti && (
        <div className="flex flex-wrap gap-3 px-1">
          {options!.map((opt, i) => (
            <div key={opt.id} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] }}
              />
              <span className="text-muted-foreground">{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
