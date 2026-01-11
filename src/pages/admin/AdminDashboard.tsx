import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Play, 
  Pause, 
  Scale, 
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminRepository } from '@/services/AdminRepository';
import { AdminMetrics, MarketEvent } from '@/types/admin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [expiringEvents, setExpiringEvents] = useState<MarketEvent[]>([]);
  const [recentEvents, setRecentEvents] = useState<MarketEvent[]>([]);

  useEffect(() => {
    setMetrics(AdminRepository.getMetrics());
    setExpiringEvents(AdminRepository.getExpiringEvents(7));
    setRecentEvents(AdminRepository.getRecentlyUpdatedEvents(5));
  }, []);

  const metricCards = [
    { 
      label: 'Total de Eventos', 
      value: metrics?.totalEvents ?? 0, 
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    { 
      label: 'Eventos Abertos', 
      value: metrics?.openEvents ?? 0, 
      icon: Play,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    { 
      label: 'Eventos Pausados', 
      value: metrics?.pausedEvents ?? 0, 
      icon: Pause,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    { 
      label: 'Aguardando Liquidação', 
      value: metrics?.awaitingSettlement ?? 0, 
      icon: Scale,
      color: 'text-accent-foreground',
      bgColor: 'bg-accent',
    },
    { 
      label: 'Eventos Liquidados', 
      value: metrics?.settledEvents ?? 0, 
      icon: CheckCircle2,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      DRAFT: { variant: 'outline', label: 'Rascunho' },
      OPEN: { variant: 'default', label: 'Aberto' },
      PAUSED: { variant: 'secondary', label: 'Pausado' },
      CLOSED: { variant: 'destructive', label: 'Fechado' },
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Soon */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Próximos da Expiração
            </CardTitle>
            <Link to="/admin/events">
              <Button variant="ghost" size="sm">
                Ver todos <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {expiringEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum evento próximo da expiração
              </p>
            ) : (
              <div className="space-y-3">
                {expiringEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={`/admin/events/${event.id}`}
                    className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Expira em {format(event.expiryAt, "dd 'de' MMMM", { locale: ptBR })}
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
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum evento recente
              </p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event) => (
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
                            SIM: {event.odds.yes}% / NÃO: {event.odds.no}%
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
