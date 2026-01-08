import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, AlertTriangle, Clock, TrendingUp, Users, DollarSign, Plus, Bot, Zap } from 'lucide-react';
import { AdminMetricsCard } from '@/components/admin/AdminMetricsCard';
import { AdminDataProvider } from '@/services/AdminDataProvider';
import { AdminMetrics } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminDataProvider.getMetrics().then((data) => {
      setMetrics(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema</p>
        </div>
        <Button asChild>
          <Link to="/admin/markets/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo Mercado
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <AdminMetricsCard
          title="Mercados Abertos"
          value={metrics?.openMarkets || 0}
          icon={Store}
          description={`${metrics?.totalMarkets || 0} total`}
          variant="success"
        />
        <AdminMetricsCard
          title="Aguardando Resultado"
          value={metrics?.pendingMarkets || 0}
          icon={Clock}
          variant="default"
        />
        <AdminMetricsCard
          title="Contestações"
          value={metrics?.pendingContestations || 0}
          icon={AlertTriangle}
          description="Pendentes de revisão"
          variant={metrics?.pendingContestations ? 'warning' : 'default'}
        />
        <AdminMetricsCard
          title="Volume Total"
          value={`R$ ${((metrics?.totalVolume || 0) / 1000).toFixed(0)}k`}
          icon={DollarSign}
          variant="default"
        />
        <AdminMetricsCard
          title="Automáticos"
          value={metrics?.automaticMarkets || 0}
          icon={Bot}
          description="Liquidação via BCB"
          variant="default"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/markets">
                <Store className="mr-2 h-4 w-4" />
                Gerenciar Mercados
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/contestations">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Revisar Contestações
                {metrics?.pendingContestations ? (
                  <span className="ml-auto rounded-full bg-warning px-2 py-0.5 text-xs text-warning-foreground">
                    {metrics.pendingContestations}
                  </span>
                ) : null}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Status dos Mercados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Abertos</span>
                <span className="font-medium text-success">{metrics?.openMarkets}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pausados</span>
                <span className="font-medium text-warning">{metrics?.haltedMarkets}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Aguardando</span>
                <span className="font-medium text-primary">{metrics?.pendingMarkets}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contestados</span>
                <span className="font-medium text-destructive">{metrics?.contestedMarkets}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Liquidados</span>
                <span className="font-medium">{metrics?.settledMarkets}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Liquidação Automática</CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3" />
                BCB API
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Mercados automáticos</span>
                </div>
                <span className="font-medium">{metrics?.automaticMarkets || 0}</span>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">APIs Suportadas:</p>
                <ul className="space-y-1">
                  <li>• SELIC / SELIC Meta (COPOM)</li>
                  <li>• IPCA (Inflação)</li>
                  <li>• CDI</li>
                  <li>• PTAX (Dólar)</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                Verificação automática diária às 18h (dias úteis)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
