import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TablePagination } from '@/components/ui/table-pagination';
import { usePagination } from '@/hooks/usePagination';
import { useAdminLedger, useFeePolicySnapshot, type LedgerEntrySecure } from '@/hooks/useSecureData';
import { Search, Download, Eye, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export function AdminLedgerPage() {
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntrySecure | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Pagination
  const pagination = usePagination({
    initialPageSize: 25,
  });

  // Filters
  const [filters, setFilters] = useState({
    userId: '',
    refType: 'all',
    status: 'all',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: ''
  });

  const [activeFilters, setActiveFilters] = useState(filters);

  // Use secure hooks with pagination
  const { data: entriesData, isLoading, refetch } = useAdminLedger({
    userId: activeFilters.userId || undefined,
    refType: activeFilters.refType !== 'all' ? activeFilters.refType : undefined,
    status: activeFilters.status !== 'all' ? activeFilters.status : undefined,
    startDate: activeFilters.startDate || undefined,
    endDate: activeFilters.endDate || undefined,
    minAmount: activeFilters.minAmount ? parseFloat(activeFilters.minAmount) : undefined,
    maxAmount: activeFilters.maxAmount ? parseFloat(activeFilters.maxAmount) : undefined,
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  const entries = entriesData || [];
  // Estimate total count based on returned data
  const totalCount = entries.length === pagination.pageSize 
    ? (pagination.page) * pagination.pageSize + 1 
    : pagination.offset + entries.length;

  const { data: snapshot } = useFeePolicySnapshot(selectedEntry?.fee_snapshot_id || null);

  const openDetails = (entry: LedgerEntrySecure) => {
    setSelectedEntry(entry);
    setDetailsOpen(true);
  };

  const handleSearch = () => {
    pagination.resetPage();
    setActiveFilters({ ...filters });
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Data', 'Tipo', 'Direção', 'Valor', 'Taxa', 'Líquido', 'Status', 'User ID'];
    const rows = entries.map(e => [
      e.id,
      format(new Date(e.created_at), 'dd/MM/yyyy HH:mm'),
      e.ref_type,
      e.direction,
      e.amount.toFixed(2),
      e.fee_amount.toFixed(2),
      e.net_amount.toFixed(2),
      e.status,
      e.user_id_masked
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'DEPOSIT': return 'default';
      case 'WITHDRAW': return 'destructive';
      case 'TRADE': return 'secondary';
      case 'SETTLEMENT': return 'outline';
      case 'ADJUSTMENT': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'default';
      case 'PENDING': return 'secondary';
      case 'FAILED': return 'destructive';
      default: return 'outline';
    }
  };

  if (isLoading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ledger Financeiro</h1>
          <p className="text-muted-foreground">
            Histórico completo de todas as movimentações
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>ID do Usuário</Label>
              <Input
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                placeholder="UUID do usuário"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={filters.refType}
                onValueChange={(v) => setFilters({ ...filters, refType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="DEPOSIT">Depósito</SelectItem>
                  <SelectItem value="WITHDRAW">Saque</SelectItem>
                  <SelectItem value="TRADE">Trade</SelectItem>
                  <SelectItem value="SETTLEMENT">Liquidação</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters({ ...filters, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="COMPLETED">Completo</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="FAILED">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Mínimo</Label>
              <Input
                type="number"
                value={filters.minAmount}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Máximo</Label>
              <Input
                type="number"
                value={filters.maxAmount}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Direção</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeBadgeVariant(entry.ref_type)}>
                      {entry.ref_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.direction === 'CREDIT' ? (
                      <span className="flex items-center text-green-600">
                        <ArrowDownRight className="h-4 w-4 mr-1" />
                        Crédito
                      </span>
                    ) : (
                      <span className="flex items-center text-red-600">
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                        Débito
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatCurrency(entry.fee_amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(entry.net_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(entry.status)}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDetails(entry)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={totalCount}
            totalPages={Math.ceil(totalCount / pagination.pageSize) || 1}
            pageNumbers={pagination.pageNumbers}
            canPrevPage={pagination.canPrevPage}
            canNextPage={pagination.canNextPage}
            startItem={pagination.startItem}
            endItem={Math.min(pagination.endItem, totalCount)}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Lançamento</DialogTitle>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">ID</Label>
                  <p className="font-mono text-sm">{selectedEntry.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User ID</Label>
                  <p className="font-mono text-sm">{selectedEntry.user_id_masked}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data</Label>
                  <p>{format(new Date(selectedEntry.created_at), 'dd/MM/yyyy HH:mm:ss')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Referência</Label>
                  <p className="font-mono text-sm">{selectedEntry.ref_id || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-muted-foreground">Valor Bruto</Label>
                  <p className="text-lg font-bold">{formatCurrency(selectedEntry.amount)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Taxa</Label>
                  <p className="text-lg font-bold text-orange-600">
                    {formatCurrency(selectedEntry.fee_amount)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor Líquido</Label>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(selectedEntry.net_amount)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Receita Plataforma</Label>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(selectedEntry.platform_revenue)}
                  </p>
                </div>
              </div>

              {snapshot && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Snapshot da Política de Taxa</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Tipo: <span className="font-medium">{snapshot.type}</span></div>
                      <div>Modo: <span className="font-medium">{snapshot.applied_mode}</span></div>
                      {snapshot.applied_percent !== null && (
                        <div>Percentual: <span className="font-medium">{(snapshot.applied_percent * 100).toFixed(2)}%</span></div>
                      )}
                      {snapshot.applied_flat !== null && (
                        <div>Valor Fixo: <span className="font-medium">{formatCurrency(snapshot.applied_flat)}</span></div>
                      )}
                    </div>
                    {snapshot.applied_tiers && snapshot.applied_tiers.length > 0 && (
                      <div className="mt-2">
                        <Label className="text-xs text-muted-foreground">Faixas Aplicadas:</Label>
                        <pre className="text-xs mt-1 p-2 bg-background rounded">
                          {JSON.stringify(snapshot.applied_tiers, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedEntry.meta && Object.keys(selectedEntry.meta).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Metadados</Label>
                  <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedEntry.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}