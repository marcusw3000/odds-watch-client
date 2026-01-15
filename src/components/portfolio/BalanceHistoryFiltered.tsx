import { useState, useMemo } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay, subDays, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Wallet, 
  Gift, 
  Filter, 
  Calendar,
  Download,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  X
} from 'lucide-react';
import { Transaction } from '@/types/market';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TransactionType = Transaction['type'] | 'WITHDRAWAL' | 'ALL';
type DatePreset = '7d' | '30d' | '90d' | 'all' | 'custom';

interface BalanceHistoryFilteredProps {
  transactions: Transaction[];
}

export function BalanceHistoryFiltered({ transactions }: BalanceHistoryFilteredProps) {
  const [typeFilter, setTypeFilter] = useState<TransactionType>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'DEPOSIT':
        return ArrowDownToLine;
      case 'BUY':
        return ArrowDownCircle;
      case 'SELL':
        return ArrowUpCircle;
      case 'PAYOUT':
        return Gift;
      default:
        return Wallet;
    }
  };

  const getTransactionLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'DEPOSIT':
        return 'Depósito';
      case 'BUY':
        return 'Compra';
      case 'SELL':
        return 'Venda';
      case 'PAYOUT':
        return 'Pagamento';
      default:
        return type;
    }
  };

  const getTransactionColor = (type: Transaction['type'], amount: number) => {
    if (amount > 0) return 'text-success';
    if (type === 'BUY') return 'text-foreground';
    return 'text-foreground';
  };

  const getDateRange = (): { start: Date | null; end: Date | null } => {
    const now = new Date();
    switch (datePreset) {
      case '7d':
        return { start: subDays(now, 7), end: now };
      case '30d':
        return { start: subDays(now, 30), end: now };
      case '90d':
        return { start: subMonths(now, 3), end: now };
      case 'custom':
        return { start: startDate || null, end: endDate || null };
      case 'all':
      default:
        return { start: null, end: null };
    }
  };

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by type
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }

    // Filter by date range
    const { start, end } = getDateRange();
    if (start && end) {
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return isWithinInterval(txDate, {
          start: startOfDay(start),
          end: endOfDay(end)
        });
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.eventTitle?.toLowerCase().includes(query) ||
        getTransactionLabel(tx.type).toLowerCase().includes(query) ||
        tx.outcome?.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return filtered;
  }, [transactions, typeFilter, datePreset, startDate, endDate, searchQuery]);

  const summary = useMemo(() => {
    const deposits = filteredTransactions
      .filter(tx => tx.type === 'DEPOSIT')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const buys = filteredTransactions
      .filter(tx => tx.type === 'BUY')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    const sells = filteredTransactions
      .filter(tx => tx.type === 'SELL')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const payouts = filteredTransactions
      .filter(tx => tx.type === 'PAYOUT')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const netFlow = deposits + sells + payouts - buys;

    return { deposits, buys, sells, payouts, netFlow, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const handleExportCSV = () => {
    const headers = ['Data', 'Tipo', 'Evento', 'Posição', 'Valor'];
    const rows = filteredTransactions.map(tx => [
      format(new Date(tx.createdAt), 'dd/MM/yyyy HH:mm'),
      getTransactionLabel(tx.type),
      tx.eventTitle || '-',
      tx.outcome || '-',
      `R$${tx.amount.toFixed(2)}`
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historico-movimentacao-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setTypeFilter('ALL');
    setDatePreset('30d');
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchQuery('');
  };

  const hasActiveFilters = typeFilter !== 'ALL' || datePreset !== '30d' || searchQuery.trim() !== '';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Histórico de Movimentação
              <Badge variant="secondary" className="ml-2">
                {summary.count} registro{summary.count !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
            <CardDescription>
              Todas as movimentações do seu saldo
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && 'bg-muted')}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="default" className="ml-2 h-5 w-5 p-0 justify-center">
                  !
                </Badge>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 rounded-lg border border-border bg-muted/50 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <label className="text-sm font-medium mb-1.5 block">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Evento, tipo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div className="w-full md:w-48">
                <label className="text-sm font-medium mb-1.5 block">Tipo</label>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="DEPOSIT">Depósitos</SelectItem>
                    <SelectItem value="BUY">Compras</SelectItem>
                    <SelectItem value="SELL">Vendas</SelectItem>
                    <SelectItem value="PAYOUT">Pagamentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Preset */}
              <div className="w-full md:w-48">
                <label className="text-sm font-medium mb-1.5 block">Período</label>
                <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 3 meses</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range */}
            {datePreset === 'custom' && (
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-48">
                  <label className="text-sm font-medium mb-1.5 block">Data inicial</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-full md:w-48">
                  <label className="text-sm font-medium mb-1.5 block">Data final</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => date > new Date() || (startDate ? date < startDate : false)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-muted-foreground">Depósitos</p>
            <p className="font-mono font-bold text-green-500">+R${summary.deposits.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted border border-border">
            <p className="text-xs text-muted-foreground">Compras</p>
            <p className="font-mono font-bold">-R${summary.buys.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-muted-foreground">Vendas</p>
            <p className="font-mono font-bold text-blue-500">+R${summary.sells.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-xs text-muted-foreground">Prêmios</p>
            <p className="font-mono font-bold text-purple-500">+R${summary.payouts.toFixed(2)}</p>
          </div>
          <div className={cn(
            "p-3 rounded-lg border",
            summary.netFlow >= 0 
              ? "bg-success/10 border-success/20" 
              : "bg-destructive/10 border-destructive/20"
          )}>
            <p className="text-xs text-muted-foreground">Fluxo Líquido</p>
            <p className={cn(
              "font-mono font-bold",
              summary.netFlow >= 0 ? "text-success" : "text-destructive"
            )}>
              {summary.netFlow >= 0 ? '+' : ''}R${summary.netFlow.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Transactions Table */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma transação encontrada.</p>
            {hasActiveFilters && (
              <Button variant="link" onClick={clearFilters} className="mt-2">
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[140px]">Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => {
                  const Icon = getTransactionIcon(tx.type);
                  const isPositive = tx.amount > 0;

                  return (
                    <TableRow key={tx.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(tx.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        <span className="block text-xs opacity-70">
                          {format(new Date(tx.createdAt), "HH:mm", { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-md",
                            isPositive ? "bg-success/10" : "bg-muted"
                          )}>
                            <Icon className={cn(
                              "h-4 w-4",
                              isPositive ? "text-success" : "text-muted-foreground"
                            )} />
                          </div>
                          <span className="font-medium text-sm">
                            {getTransactionLabel(tx.type)}
                          </span>
                          {tx.outcome && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                tx.outcome === 'YES' 
                                  ? "border-yes text-yes" 
                                  : "border-no text-no"
                              )}
                            >
                              {tx.outcome}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {tx.eventTitle || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-mono font-bold",
                          getTransactionColor(tx.type, tx.amount)
                        )}>
                          {isPositive ? '+' : ''}R${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
