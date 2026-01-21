import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FinancialRepository } from '@/services/FinancialRepository';
import type { PlatformRevenue, RevenueByDay } from '@/types/financial';
import { format, subDays } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';

export function AdminRevenuePage() {
  const [revenue, setRevenue] = useState<PlatformRevenue[]>([]);
  const [revenueByDay, setRevenueByDay] = useState<RevenueByDay[]>([]);
  const [revenueByType, setRevenueByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [revenueData, dayData, typeData] = await Promise.all([
        FinancialRepository.getPlatformRevenue(dateRange.start, dateRange.end),
        FinancialRepository.getRevenueByDay(30),
        FinancialRepository.getRevenueByType()
      ]);
      setRevenue(revenueData);
      setRevenueByDay(dayData);
      setRevenueByType(typeData);
    } catch (error) {
      console.error('Error loading revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalRevenue = Object.values(revenueByType).reduce((sum, v) => sum + v, 0);

  // Prepare chart data by grouping by day
  const chartData = revenueByDay.reduce((acc, item) => {
    const existing = acc.find(d => d.day === item.day);
    if (existing) {
      existing[item.type] = item.amount;
      existing.total = ((existing.total as number) || 0) + item.amount;
    } else {
      acc.push({
        day: item.day,
        [item.type]: item.amount,
        total: item.amount
      });
    }
    return acc;
  }, [] as Record<string, unknown>[]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Receita da Plataforma</h1>
        <p className="text-muted-foreground">
          Análise detalhada das receitas por período e tipo
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depósitos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenueByType['DEPOSIT'] || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalRevenue > 0 
                ? `${(((revenueByType['DEPOSIT'] || 0) / totalRevenue) * 100).toFixed(2)}% do total`
                : '0.00% do total'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saques</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenueByType['WITHDRAW'] || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalRevenue > 0 
                ? `${(((revenueByType['WITHDRAW'] || 0) / totalRevenue) * 100).toFixed(2)}% do total`
                : '0.00% do total'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trades</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenueByType['TRADE'] || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalRevenue > 0 
                ? `${(((revenueByType['TRADE'] || 0) / totalRevenue) * 100).toFixed(2)}% do total`
                : '0.00% do total'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtrar Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
            <Button onClick={loadData}>Aplicar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Day Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Receita por Dia</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]" style={{ contain: 'layout style' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="day" 
                tickFormatter={(value) => format(new Date(value), 'dd/MM')}
              />
              <YAxis tickFormatter={(value) => `R$${value}`} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => format(new Date(label), 'dd/MM/yyyy')}
              />
              <Legend />
              <Bar dataKey="DEPOSIT" name="Depósitos" fill="hsl(var(--chart-1))" stackId="a" />
              <Bar dataKey="WITHDRAW" name="Saques" fill="hsl(var(--chart-2))" stackId="a" />
              <Bar dataKey="TRADE" name="Trades" fill="hsl(var(--chart-3))" stackId="a" />
              <Bar dataKey="SETTLEMENT" name="Liquidações" fill="hsl(var(--chart-4))" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Taxas</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenue.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(new Date(item.day), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(item.gross)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-primary">
                    {formatCurrency(item.fees)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(item.net)}
                  </TableCell>
                </TableRow>
              ))}
              {revenue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum registro de receita encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
