import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  ExternalLink,
  Edit,
  Pause,
  Play,
  Lock,
  Scale,
  History,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAdminEvent, useUpdateEventStatus } from '@/hooks/useAdminEvents';
import { MarketStatus, MARKET_STATUS_LABELS, MARKET_STATUS_VARIANTS } from '@/types/market';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [statusDialog, setStatusDialog] = useState<{ 
    open: boolean; 
    action: 'pause' | 'resume' | 'close' | 'open' | null 
  }>({
    open: false,
    action: null,
  });

  const { data, isLoading, error } = useAdminEvent(id);
  const updateStatusMutation = useUpdateEventStatus();

  const event = data?.event;
  const auditLogs = data?.auditLogs || [];

  const handleStatusChange = (action: 'pause' | 'resume' | 'close' | 'open') => {
    setStatusDialog({ open: true, action });
  };

  const confirmStatusChange = async () => {
    if (!event || !statusDialog.action) return;

    const statusMap: Record<string, MarketStatus> = {
      pause: 'HALTED',
      resume: 'OPEN',
      close: 'PENDING',
      open: 'OPEN',
    };

    try {
      await updateStatusMutation.mutateAsync({
        eventId: event.id,
        status: statusMap[statusDialog.action],
      });
      toast.success('Status atualizado com sucesso');
    } catch (err) {
      toast.error('Erro ao atualizar status');
    }

    setStatusDialog({ open: false, action: null });
  };

  const getStatusBadge = (status: MarketStatus) => {
    return <Badge variant={MARKET_STATUS_VARIANTS[status]} className="text-sm">{MARKET_STATUS_LABELS[status]}</Badge>;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      market_status_change: 'Status alterado',
      market_settled: 'Evento liquidado',
      market_deleted: 'Evento excluído',
      CREATED: 'Evento criado',
      ODDS_CHANGED: 'Odds alteradas',
      STATUS_CHANGED: 'Status alterado',
      PAUSED: 'Evento pausado',
      RESUMED: 'Evento reaberto',
      CLOSED: 'Mercado fechado',
      SETTLED: 'Evento liquidado',
      EDITED: 'Evento editado',
    };
    return labels[action] || action;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Evento não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/admin/events')}>
          Voltar para eventos
        </Button>
      </div>
    );
  }

  const isEditable = event.status !== 'SETTLED';
  const canChangeOdds = event.status === 'OPEN';
  const canSettle = event.status === 'PENDING' || event.status === 'CONTESTED';

  const resolution = event.resolution as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/events')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            {getStatusBadge(event.status)}
          </div>
          <p className="text-muted-foreground">{event.category}</p>
        </div>
        <div className="flex gap-2">
          {event.status === 'HALTED' && (
            <Button onClick={() => handleStatusChange('open')} disabled={updateStatusMutation.isPending}>
              <Play className="h-4 w-4 mr-2" />
              Abrir Mercado
            </Button>
          )}
          {event.status === 'OPEN' && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange('pause')} disabled={updateStatusMutation.isPending}>
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
              <Button variant="outline" onClick={() => handleStatusChange('close')} disabled={updateStatusMutation.isPending}>
                <Lock className="h-4 w-4 mr-2" />
                Fechar
              </Button>
            </>
          )}
          {event.status === 'HALTED' && (
            <Button variant="outline" onClick={() => handleStatusChange('close')} disabled={updateStatusMutation.isPending}>
              <Lock className="h-4 w-4 mr-2" />
              Submeter para Liquidação
            </Button>
          )}
          {canSettle && (
            <Link to={`/admin/settlements?event=${event.id}`}>
              <Button>
                <Scale className="h-4 w-4 mr-2" />
                Liquidar
              </Button>
            </Link>
          )}
          {isEditable && (
            <Link to={`/admin/events/${event.id}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{event.description || 'Sem descrição'}</p>
            </CardContent>
          </Card>

          {/* Resolution Source */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Fonte Oficial de Resolução
                <Badge variant="outline">{(resolution?.type as string) || 'MANUAL'}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Nome da Fonte</p>
                <p className="font-medium">{(resolution?.name as string) || 'Não definida'}</p>
              </div>
              {resolution?.url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">URL Pública</p>
                  <a
                    href={resolution.url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {resolution.url as string}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
              {resolution?.rule && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Regra de Resolução</p>
                  <p className="font-medium bg-muted/50 p-3 rounded-lg border">
                    {resolution.rule as string}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma alteração registrada</p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log, index) => {
                    const details = log.details as Record<string, unknown>;
                    return (
                      <div key={log.id}>
                        <div className="flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{getActionLabel(log.action)}</p>
                            {details?.previous_status && (
                              <p className="text-xs text-muted-foreground">
                                De: {details.previous_status as string} → Para: {details.new_status as string}
                              </p>
                            )}
                            {details?.reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Motivo: {details.reason as string}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {(details?.admin_name as string) || 'Admin'} • {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        {index < auditLogs.length - 1 && <Separator className="my-4" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Odds */}
          <Card>
            <CardHeader>
              <CardTitle>Odds Atuais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <p className="text-3xl font-bold text-success">{Math.round(event.current_yes_price * 100)}%</p>
                  <p className="text-sm text-muted-foreground">SIM</p>
                </div>
                <div className="text-center p-4 bg-destructive/10 rounded-lg">
                  <p className="text-3xl font-bold text-destructive">{Math.round(event.current_no_price * 100)}%</p>
                  <p className="text-sm text-muted-foreground">NÃO</p>
                </div>
              </div>
              {canChangeOdds && (
                <Link to={`/admin/events/${event.id}/edit`} className="block mt-4">
                  <Button variant="outline" className="w-full">
                    Alterar Odds
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Datas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {event.close_date && (
                <>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Fechamento</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.close_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Separator />
                </>
              )}
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Criado em</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Atualizado em</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settlement Result (if settled) */}
          {event.status === 'SETTLED' && event.result && (
            <Card>
              <CardHeader>
                <CardTitle>Resultado da Liquidação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-center p-4 rounded-lg ${
                  event.result === 'YES' ? 'bg-success/10' : 'bg-destructive/10'
                }`}>
                  <p className={`text-2xl font-bold ${
                    event.result === 'YES' ? 'text-success' : 'text-destructive'
                  }`}>
                    {event.result === 'YES' ? 'SIM' : 'NÃO'}
                  </p>
                  {event.settlement_date && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Liquidado em {format(new Date(event.settlement_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
                {event.result_source && (
                  <a
                    href={event.result_source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-3 justify-center"
                  >
                    Ver evidência <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Status Change Dialog */}
      <AlertDialog open={statusDialog.open} onOpenChange={(open) => !open && setStatusDialog({ open: false, action: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusDialog.action === 'pause' && 'Pausar Evento'}
              {statusDialog.action === 'resume' && 'Reabrir Evento'}
              {statusDialog.action === 'close' && 'Fechar Mercado'}
              {statusDialog.action === 'open' && 'Abrir Mercado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusDialog.action === 'pause' && 'O evento será pausado e não aceitará novas apostas até ser reaberto.'}
              {statusDialog.action === 'resume' && 'O evento será reaberto e voltará a aceitar apostas.'}
              {statusDialog.action === 'close' && 'O mercado será fechado permanentemente. Após fechado, só poderá ser liquidado.'}
              {statusDialog.action === 'open' && 'O mercado será aberto e começará a aceitar apostas.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
