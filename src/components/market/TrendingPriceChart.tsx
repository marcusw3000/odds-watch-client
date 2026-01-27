import { memo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

interface ChartDataPoint {
  date: string;
  fullDate: string;
  yes: number;
  no: number;
}

interface TrendingPriceChartProps {
  data: ChartDataPoint[];
  isSettled?: boolean;
  resultIsYes?: boolean;
}

export const TrendingPriceChart = memo(function TrendingPriceChart({
  data,
  isSettled,
  resultIsYes,
}: TrendingPriceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 5, right: 45, left: 0, bottom: 5 }}>
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
          ticks={[30, 50, 70]}
        />
        <ReferenceLine 
          y={50} 
          stroke="hsl(var(--muted-foreground))" 
          strokeDasharray="3 3" 
          strokeOpacity={0.5}
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
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="no"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: 'hsl(var(--muted-foreground))' }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

export default TrendingPriceChart;
