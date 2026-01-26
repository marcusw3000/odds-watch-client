import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Play, 
  Pause, 
  Scale, 
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Loader2,
  DollarSign,
  Users,
  Wallet,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  useAdminMetrics, 
  useExpiringEvents, 
  useRecentEvents,
  AdminEvent 
} from '@/hooks/useAdminEvents';
import { useAdminDashboardMetrics } from '@/hooks/useAdminDashboardMetrics';
import { DataIntegrityCard } from '@/components/admin/DataIntegrityCard';
import { MetricCard } from '@/components/admin/MetricCard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useAdminMetrics();
  const { data: dashboardMetrics, isLoading: dashboardMetricsLoading } = useAdminDashboardMetrics();
  const { data: expiringEvents = [], isLoading: expiringLoading } = useExpiringEvents(7);
  const { data: recentEvents = [], isLoading: recentLoading } = useRecentEvents(5);
  
  const eventMetricCards = [
    { 
      label: 'Total de Eventos', 
      value: metrics?.totalEvents ?? 0, 
      icon: Calendar,
      iconColor: 'text-primary',
      iconBgColor: 'bg-primary/10',
    },
    { 
      label: 'Eventos Abertos', 
      value: metrics?.openEvents ?? 0, 
      icon: Play,
      iconColor: 'text-emerald-600',
      iconBgColor: 'bg-emerald-500/10',
    },
    { 
      label: 'Eventos Pausados', 
      value: metrics?.pausedEvents ?? 0, 
      icon: Pause,
      iconColor: 'text-amber-600',
      iconBgColor: 'bg-amber-500/10',
    },
    { 
      label: 'Aguardando Liquidação', 
      value: metrics?.awaitingSettlement ?? 0, 
      icon: Scale,
      iconColor: 'text-blue-600',
      iconBgColor: 'bg-blue-500/10',
    },
    { 
      label: 'Eventos Liquidados', 
      value: metrics?.settledEvents ?? 0, 
      icon: CheckCircle2,
      iconColor: 'text-muted-foreground',
      iconBgColor: 'bg-muted',
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      DRAFT: { variant: 'outline', label: 'Rascunho' },
      OPEN: { variant: 'default', label: 'Aberto' },
      HALTED: { variant: 'secondary', label: 'Pausado' },
      PENDING: { variant: 'destructive', label: 'Fechado' },
      SETTLED: { variant: 'outline', label: 'Liquidado' },
    };
    const { variant, label } = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral do sistema de mercados preditivos
        </p>
      </div>

      {/* Data Integrity - Top */}
      <DataIntegrityCard />

      {/* Event Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {eventMetricCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            iconColor={card.iconColor}
            iconBgColor={card.iconBgColor}
            loading={metricsLoading}
          />
        ))}
      </div>

      {/* Financial Metrics with Comparatives */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Volume Total"
          value={dashboardMetrics?.totalVolume ?? 0}
          previousValue={dashboardMetrics?.totalVolumePrev}
          changePercent={dashboardMetrics?.totalVolumeChange}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBgColor="bg-emerald-500/10"
          loading={dashboardMetricsLoading}
          format="currency"
          tooltipPrevLabel="Período anterior"
        />

        <MetricCard
          label="Receita Pendente"
          value={dashboardMetrics?.pendingRevenue ?? 0}
          icon={TrendingUp}
          iconColor="text-amber-600"
          iconBgColor="bg-amber-500/10"
          loading={dashboardMetricsLoading}
          format="currency"
        />

        <MetricCard
          label="Usuários Ativos (7d)"
          value={dashboardMetrics?.activeUsers7d ?? 0}
          previousValue={dashboardMetrics?.activeUsers7dPrev}
          changePercent={dashboardMetrics?.activeUsers7dChange}
          icon={Users}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-500/10"
          loading={dashboardMetricsLoading}
          tooltipPrevLabel="7 dias anteriores"
        />

        <MetricCard
          label="Depósitos Hoje"
          value={dashboardMetrics?.depositsToday ?? 0}
          previousValue={dashboardMetrics?.depositsTodayPrev}
          changePercent={dashboardMetrics?.depositsTodayChange}
          icon={Wallet}
          iconColor="text-violet-600"
          iconBgColor="bg-violet-500/10"
          loading={dashboardMetricsLoading}
          format="currency"
          tooltipPrevLabel="Ontem"
        />

        <MetricCard
          label="Trades Hoje"
          value={dashboardMetrics?.tradesHoje ?? 0}
          previousValue={dashboardMetrics?.tradesHojePrev}
          changePercent={dashboardMetrics?.tradesHojeChange}
          icon={BarChart3}
          iconColor="text-pink-600"
          iconBgColor="bg-pink-500/10"
          loading={dashboardMetricsLoading}
          tooltipPrevLabel="Ontem"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Soon */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Próximos da Expiração
            </CardTitle>
            <Link to="/admin/events">
              <Button variant="ghost" size="sm">
                Ver todos <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {expiringLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : expiringEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum evento próximo da expiração
              </p>
            ) : (
              <div className="space-y-3">
                {expiringEvents.map((event: AdminEvent) => (
                  <Link
                    key={event.id}
                    to={`/admin/events/${event.id}`}
                    className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Expira em {event.close_date && format(new Date(event.close_date), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      </div>
                      {getStatusBadge(event.status)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Updated */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Atualizados Recentemente
            </CardTitle>
            <Link to="/admin/events">
              <Button variant="ghost" size="sm">
                Ver todos <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum evento recente
              </p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event: AdminEvent) => (
                  <Link
                    key={event.id}
                    to={`/admin/events/${event.id}`}
                    className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            SIM: {Math.round(event.current_yes_price * 100)}% / NÃO: {Math.round(event.current_no_price * 100)}%
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(event.status)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/events/new">
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Criar Novo Evento
              </Button>
            </Link>
            <Link to="/admin/settlements">
              <Button variant="outline">
                <Scale className="h-4 w-4 mr-2" />
                Ver Liquidações Pendentes
              </Button>
            </Link>
            <Link to="/admin/audit">
              <Button variant="outline">
                <Clock className="h-4 w-4 mr-2" />
                Ver Auditoria
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
