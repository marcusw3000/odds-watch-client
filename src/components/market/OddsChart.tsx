import { format } from 'date-fns';
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
import { OddsHistoryPoint } from '@/types/market';

interface OddsChartProps {
  data: OddsHistoryPoint[];
}

export function OddsChart({ data }: OddsChartProps) {
  const chartData = data.map((point) => ({
    date: format(point.timestamp, 'dd/MM', { locale: ptBR }),
    fullDate: format(point.timestamp, "dd MMM yyyy", { locale: ptBR }),
    yes: point.yesPrice,
    no: point.noPrice,
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--yes))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--yes))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="noGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--no))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--no))" stopOpacity={0} />
            </linearGradient>
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
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                  <p className="text-xs text-muted-foreground mb-2">{data.fullDate}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-yes">SIM</span>
                      <span className="font-mono text-sm">R${(data.yes / 100).toFixed(2)} ({data.yes}%)</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-no">NÃO</span>
                      <span className="font-mono text-sm">R${(data.no / 100).toFixed(2)} ({data.no}%)</span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="yes"
            stroke="hsl(var(--yes))"
            strokeWidth={2}
            fill="url(#yesGradient)"
            name="SIM"
          />
          <Area
            type="monotone"
            dataKey="no"
            stroke="hsl(var(--no))"
            strokeWidth={2}
            fill="url(#noGradient)"
            name="NÃO"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
