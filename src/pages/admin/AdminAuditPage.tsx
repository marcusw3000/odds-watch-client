import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Filter,
  ExternalLink,
  Loader2
} from 'lucide-react';
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
import { useAdminAuditLogs, AuditLogEntry } from '@/hooks/useAdminEvents';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const { data: logs = [], isLoading } = useAdminAuditLogs(actionFilter);

  const getActionBadge = (action: string) => {
    const configs: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      create_market: { variant: 'default', label: 'Criado' },
      update_event: { variant: 'outline', label: 'Editado' },
      update_market: { variant: 'outline', label: 'Editado' },
      update_status: { variant: 'secondary', label: 'Status' },
      settle_market: { variant: 'destructive', label: 'Liquidado' },
      delete_market: { variant: 'destructive', label: 'Excluído' },
      update_card_style: { variant: 'outline', label: 'Estilo' },
      // Legacy actions from old system
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

  const actions = [
    'create_market',
    'update_event',
    'update_status',
    'settle_market',
    'delete_market',
    'update_card_style',
  ];

  // Helper to extract title from after_data
  const getEventTitle = (log: AuditLogEntry) => {
    if (log.after_data && typeof log.after_data === 'object' && 'title' in log.after_data) {
      return String(log.after_data.title);
    }
    if (log.before_data && typeof log.before_data === 'object' && 'title' in log.before_data) {
      return String(log.before_data.title);
    }
    return null;
  };

  // Helper to get reason from after_data
  const getReason = (log: AuditLogEntry) => {
    if (log.after_data && typeof log.after_data === 'object' && 'reason' in log.after_data) {
      return String(log.after_data.reason);
    }
    return null;
  };

  // Helper to get previous/new values for display
  const getChangeDisplay = (log: AuditLogEntry) => {
    const before = log.before_data;
    const after = log.after_data;

    if (log.action === 'update_status' && after && typeof after === 'object' && 'status' in after) {
      const prevStatus = before && typeof before === 'object' && 'status' in before ? before.status : '-';
      return { previous: String(prevStatus), current: String(after.status) };
    }

    if (log.action === 'settle_market' && after && typeof after === 'object' && 'result' in after) {
      return { previous: 'PENDING', current: `Resultado: ${after.result}` };
    }

    return { previous: '-', current: '-' };
  };

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
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <p className="text-2xl font-bold">{logs.length}</p>
            )}
            <p className="text-sm text-muted-foreground">Total de ações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <p className="text-2xl font-bold">
                {logs.filter(l => l.action === 'update_event' || l.action === 'ODDS_CHANGED').length}
              </p>
            )}
            <p className="text-sm text-muted-foreground">Edições</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <p className="text-2xl font-bold">
                {logs.filter(l => l.action === 'settle_market' || l.action === 'SETTLED').length}
              </p>
            )}
            <p className="text-sm text-muted-foreground">Liquidações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <p className="text-2xl font-bold">
                {logs.filter(l => l.action === 'create_market' || l.action === 'CREATED').length}
              </p>
            )}
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
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
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
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const eventTitle = getEventTitle(log);
                    const reason = getReason(log);
                    const changes = getChangeDisplay(log);

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <span className="text-sm">
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          {log.entity_id && eventTitle ? (
                            <Link 
                              to={`/admin/events/${log.entity_id}`}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {eventTitle.length > 30 ? `${eventTitle.substring(0, 30)}...` : eventTitle}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : log.entity_id ? (
                            <Link 
                              to={`/admin/events/${log.entity_id}`}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              Ver evento
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {changes.previous}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {changes.current}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {reason || '-'}
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