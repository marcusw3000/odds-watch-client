import { RefreshCw, Server, Database, Shield, Activity, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSystemHealth, EdgeFunctionHealth } from '@/hooks/useSystemHealth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function StatusIcon({ status }: { status: 'online' | 'degraded' | 'offline' | 'healthy' | 'down' }) {
  switch (status) {
    case 'online':
    case 'healthy':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'degraded':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'offline':
    case 'down':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

function StatusBadge({ status }: { status: 'online' | 'degraded' | 'offline' | 'healthy' | 'down' }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    online: { variant: 'default', label: 'Online' },
    healthy: { variant: 'default', label: 'Saudável' },
    degraded: { variant: 'secondary', label: 'Degradado' },
    offline: { variant: 'destructive', label: 'Offline' },
    down: { variant: 'destructive', label: 'Indisponível' },
  };
  
  const config = variants[status] || variants.offline;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function FunctionRow({ fn }: { fn: EdgeFunctionHealth }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon status={fn.status} />
        <div>
          <p className="font-medium text-sm">{fn.name}</p>
          {fn.last_error && (
            <p className="text-xs text-destructive mt-0.5 truncate max-w-[300px]">
              {fn.last_error}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={cn(
          'text-sm font-mono',
          fn.latency_ms > 2000 ? 'text-amber-500' : 
          fn.latency_ms > 5000 ? 'text-red-500' : 'text-muted-foreground'
        )}>
          {fn.latency_ms > 0 ? `${fn.latency_ms}ms` : '-'}
        </span>
        <StatusBadge status={fn.status} />
      </div>
    </div>
  );
}

export function AdminSystemPage() {
  const { data: health, isLoading, refetch, isFetching } = useSystemHealth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Monitoramento de saúde do sistema
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : health ? (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'p-3 rounded-lg',
                    health.database === 'healthy' ? 'bg-emerald-500/10' :
                    health.database === 'degraded' ? 'bg-amber-500/10' : 'bg-red-500/10'
                  )}>
                    <Database className={cn(
                      'h-5 w-5',
                      health.database === 'healthy' ? 'text-emerald-500' :
                      health.database === 'degraded' ? 'text-amber-500' : 'text-red-500'
                    )} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Banco de Dados</p>
                    <StatusBadge status={health.database} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'p-3 rounded-lg',
                    health.auth === 'healthy' ? 'bg-emerald-500/10' :
                    health.auth === 'degraded' ? 'bg-amber-500/10' : 'bg-red-500/10'
                  )}>
                    <Shield className={cn(
                      'h-5 w-5',
                      health.auth === 'healthy' ? 'text-emerald-500' :
                      health.auth === 'degraded' ? 'text-amber-500' : 'text-red-500'
                    )} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Autenticação</p>
                    <StatusBadge status={health.auth} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Latência Média</p>
                    <p className="text-xl font-bold font-mono">
                      {health.metrics.avg_query_latency}ms
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Edge Functions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Edge Functions
              </CardTitle>
              <CardDescription>
                Status das funções serverless
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {health.functions.map((fn) => (
                  <FunctionRow key={fn.name} fn={fn} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Last Check */}
          <p className="text-xs text-muted-foreground text-center">
            Última verificação: {format(new Date(health.checked_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          </p>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Não foi possível carregar os dados de saúde do sistema.
        </div>
      )}
    </div>
  );
}
