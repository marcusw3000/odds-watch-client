import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Filter,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminRepository } from '@/services/AdminRepository';
import { AuditLog } from '@/types/admin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    setLogs(AdminRepository.getAuditLogs());
  }, []);

  const filteredLogs = logs.filter(log => 
    actionFilter === 'all' || log.action === actionFilter
  );

  const getActionBadge = (action: AuditLog['action']) => {
    const configs: Record<AuditLog['action'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      CREATED: { variant: 'default', label: 'Criado' },
      ODDS_CHANGED: { variant: 'secondary', label: 'Odds' },
      STATUS_CHANGED: { variant: 'outline', label: 'Status' },
      PAUSED: { variant: 'secondary', label: 'Pausado' },
      RESUMED: { variant: 'default', label: 'Reaberto' },
      CLOSED: { variant: 'destructive', label: 'Fechado' },
      SETTLED: { variant: 'outline', label: 'Liquidado' },
      EDITED: { variant: 'outline', label: 'Editado' },
    };
    const config = configs[action] || { variant: 'outline', label: action };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const actions: AuditLog['action'][] = [
    'CREATED', 'ODDS_CHANGED', 'STATUS_CHANGED', 'PAUSED', 'RESUMED', 'CLOSED', 'SETTLED', 'EDITED'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Auditoria</h1>
          <p className="text-muted-foreground mt-1">
            Registro de todas as ações administrativas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar por ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {actions.map(action => (
                <SelectItem key={action} value={action}>{action}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{logs.length}</p>
            <p className="text-sm text-muted-foreground">Total de ações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">
              {logs.filter(l => l.action === 'ODDS_CHANGED').length}
            </p>
            <p className="text-sm text-muted-foreground">Alterações de odds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">
              {logs.filter(l => l.action === 'SETTLED').length}
            </p>
            <p className="text-sm text-muted-foreground">Liquidações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">
              {logs.filter(l => l.action === 'CREATED').length}
            </p>
            <p className="text-sm text-muted-foreground">Eventos criados</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Ações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Anterior</TableHead>
                    <TableHead>Novo</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const event = AdminRepository.getEvent(log.eventId);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <span className="text-sm">
                            {format(log.timestamp, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          {event ? (
                            <Link 
                              to={`/admin/events/${log.eventId}`}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {event.title.substring(0, 30)}...
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {log.previousValue || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {log.newValue}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{log.admin}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {log.reason || '-'}
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
    </div>
  );
}
