import { useEffect, useState } from 'react';
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
import { FinancialRepository } from '@/services/FinancialRepository';
import type { AdminAuditLog } from '@/types/financial';
import { format } from 'date-fns';
import { Eye, Search, Shield } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  'FEE_RULE_CREATED': 'Regra Criada',
  'FEE_RULE_UPDATED': 'Regra Atualizada',
  'FEE_RULE_ACTIVATED': 'Regra Ativada',
  'FEE_RULE_DEACTIVATED': 'Regra Desativada',
  'EVENT_SETTLED': 'Evento Liquidado',
  'MANUAL_ADJUST': 'Ajuste Manual',
  'WALLET_ADJUSTED': 'Saldo Ajustado',
  'MARKET_CLOSED': 'Mercado Fechado',
  'MARKET_SETTLED': 'Mercado Liquidado',
  'ROLE_ASSIGNED': 'Role Atribuído',
  'ROLE_REMOVED': 'Role Removido',
  'WITHDRAWAL_COMPLETED': 'Saque Aprovado',
  'WITHDRAWAL_FAILED': 'Saque Rejeitado',
};

export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Pagination
  const pagination = usePagination({
    initialPageSize: 25,
    totalItems: totalCount,
  });

  // Filters
  const [filters, setFilters] = useState({
    action: '',
    entity: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadLogs();
  }, [pagination.page, pagination.pageSize]);

  const loadLogs = async () => {
    setLoading(true);
    const data = await FinancialRepository.getAuditLogs({
      action: filters.action || undefined,
      entity: filters.entity || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      limit: pagination.pageSize,
      offset: pagination.offset,
    });
    setLogs(data);
    // For now, we don't have total count from the API, so we estimate
    // If data length equals pageSize, there might be more
    if (data.length === pagination.pageSize) {
      setTotalCount((pagination.page) * pagination.pageSize + 1);
    } else {
      setTotalCount(pagination.offset + data.length);
    }
    setLoading(false);
  };

  const openDetails = (log: AdminAuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleSearch = () => {
    pagination.resetPage();
    loadLogs();
  };

  const getActionLabel = (action: string) => {
    return ACTION_LABELS[action] || action;
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('CREATED')) return 'default';
    if (action.includes('UPDATED') || action.includes('ADJUSTED')) return 'secondary';
    if (action.includes('DEACTIVATED')) return 'destructive';
    if (action.includes('SETTLED')) return 'outline';
    return 'outline';
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Logs de Auditoria</h1>
          <p className="text-muted-foreground">
            Histórico completo de todas as ações administrativas
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select
                value={filters.action || 'all'}
                onValueChange={(v) => setFilters({ ...filters, action: v === 'all' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="FEE_RULE_CREATED">Regra Criada</SelectItem>
                  <SelectItem value="FEE_RULE_UPDATED">Regra Atualizada</SelectItem>
                  <SelectItem value="FEE_RULE_ACTIVATED">Regra Ativada</SelectItem>
                  <SelectItem value="FEE_RULE_DEACTIVATED">Regra Desativada</SelectItem>
                  <SelectItem value="EVENT_SETTLED">Evento Liquidado</SelectItem>
                  <SelectItem value="MANUAL_ADJUST">Ajuste Manual</SelectItem>
                  <SelectItem value="WALLET_ADJUSTED">Saldo Ajustado</SelectItem>
                  <SelectItem value="ROLE_ASSIGNED">Role Atribuído</SelectItem>
                  <SelectItem value="ROLE_REMOVED">Role Removido</SelectItem>
                  <SelectItem value="WITHDRAWAL_COMPLETED">Saque Aprovado</SelectItem>
                  <SelectItem value="WITHDRAWAL_FAILED">Saque Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entidade</Label>
              <Select
                value={filters.entity || 'all'}
                onValueChange={(v) => setFilters({ ...filters, entity: v === 'all' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="fee_rules">Regras de Taxa</SelectItem>
                  <SelectItem value="wallets">Carteiras</SelectItem>
                  <SelectItem value="markets">Mercados</SelectItem>
                  <SelectItem value="ledger_entries">Ledger</SelectItem>
                  <SelectItem value="user_roles">Roles de Usuário</SelectItem>
                  <SelectItem value="payments">Pagamentos</SelectItem>
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

            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>ID da Entidade</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead className="text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.entity}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.entity_id ? log.entity_id.substring(0, 8) + '...' : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {log.profiles?.display_name || 'Sem nome'}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {log.actor_user_id.substring(0, 8)}...
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDetails(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum log de auditoria encontrado
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log de Auditoria</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">ID do Log</Label>
                  <p className="font-mono text-sm">{selectedLog.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data/Hora</Label>
                  <p>{format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ator</Label>
                  <p className="font-medium">{selectedLog.profiles?.display_name || 'Sem nome'}</p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedLog.actor_user_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP</Label>
                  <p className="font-mono text-sm">{selectedLog.ip_address || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-muted-foreground">Ação</Label>
                  <p className="font-medium">{getActionLabel(selectedLog.action)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entidade</Label>
                  <p className="font-medium">{selectedLog.entity}</p>
                </div>
              </div>

              {selectedLog.entity_id && (
                <div>
                  <Label className="text-muted-foreground">ID da Entidade Afetada</Label>
                  <p className="font-mono text-sm">{selectedLog.entity_id}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Estado Anterior (Before)</Label>
                  <pre className="p-4 bg-red-50 dark:bg-red-950 rounded-lg text-xs overflow-auto max-h-60">
                    {selectedLog.before_data 
                      ? JSON.stringify(selectedLog.before_data, null, 2)
                      : 'N/A (criação)'
                    }
                  </pre>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Estado Novo (After)</Label>
                  <pre className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-xs overflow-auto max-h-60">
                    {selectedLog.after_data 
                      ? JSON.stringify(selectedLog.after_data, null, 2)
                      : 'N/A'
                    }
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
