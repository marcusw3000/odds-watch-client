import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDiskMetrics, useSystemHealth } from '@/hooks/useSystemHealth';
import { getOperationalAlerts } from '@/lib/operationalAlerts';
import { diskUsageLevel } from '@/lib/supabaseDiskMetrics';

const date = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem registro';

export function AdminSystemPage() {
  const { data, isLoading, isError, refetch, isFetching } = useSystemHealth();
  const disk = useDiskMetrics();
  const latestSync = data?.catalog?.latest_sync ? Date.parse(data.catalog.latest_sync) : NaN;
  const cacheAgeMinutes = Number.isFinite(latestSync) ? Math.max(0, Math.floor((Date.now() - latestSync) / 60000)) : null;
  const operational = data?.operational;
  const operationalAlerts = operational ? getOperationalAlerts(operational, Date.now()) : [];
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Sistema</h1><p className="text-muted-foreground">Disponibilidade e sincronização Polymarket</p></div><Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div>
    {isLoading ? <p>Carregando...</p> : isError || !data ? <p role="alert" className="text-destructive">Não foi possível carregar o monitoramento.</p> : <>
      <div className="grid gap-4 md:grid-cols-3">{[['Banco de dados', data.database ? 'Respondendo' : 'Indisponível'], ['Autenticação', data.auth ? 'Respondendo' : 'Indisponível'], ['Tempo das consultas', `${data.latencyMs} ms`]].map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle>Catálogo e agendamentos</CardTitle></CardHeader><CardContent className="space-y-4">{data.catalogError || !data.catalog ? <p role="alert" className="text-destructive">Dados administrativos do catálogo indisponíveis.</p> : <>
        <p>Mercados em cache: {data.catalog.market_count.toLocaleString('pt-BR')}</p><p>Atualização mais recente de um mercado: {date(data.catalog.latest_sync)}</p><p>Última verificação de encerramento: {date(data.catalog.latest_closure_check)}</p>
        <p role={cacheAgeMinutes === null || cacheAgeMinutes > 60 ? 'status' : undefined} className={cacheAgeMinutes === null || cacheAgeMinutes > 60 ? 'text-amber-500' : 'text-muted-foreground'}>{cacheAgeMinutes === null ? 'Idade da cache indisponível.' : `Última atualização de um mercado há ${cacheAgeMinutes} min${cacheAgeMinutes > 60 ? ' — verifique a sincronização.' : '.'}`}</p>
        {data.catalog.jobs.length ? data.catalog.jobs.map(job => <div className="border-t pt-3 text-sm" key={job.name}><p className="font-semibold">{job.name} · {job.active ? 'Ativo' : 'Pausado'}</p><p className="text-muted-foreground">Agendamento: {job.schedule} · Última execução: {date(job.last_run)} · {job.last_status ?? 'Sem resultado'}</p></div>) : <p>Nenhum agendamento encontrado.</p>}
        <p className="text-xs text-muted-foreground">O resultado do agendamento indica o envio da requisição; consulte os logs HTTP para confirmar a resposta da função. A atualização mais recente não garante cobertura completa da cache.</p>
      </>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Operação e armazenamento</CardTitle></CardHeader><CardContent className="space-y-3">{!data.operational ? <p role="alert">Métricas operacionais indisponíveis. Verifique a migration e as permissões.</p> : <>
        {operationalAlerts.length > 0 && <div role="alert" className="rounded-md border border-amber-500/50 p-3 text-sm text-amber-500"><p className="font-semibold">Atenção</p>{operationalAlerts.map(message => <p key={message}>{message}</p>)}</div>}
        <p>Banco de dados: {(data.operational.database_bytes / 1048576).toFixed(1)} MiB · Cache de mercados e índices: {(data.operational.market_cache_bytes / 1048576).toFixed(1)} MiB</p>
        <p>Disco de dados: {disk.isLoading ? 'Carregando...' : disk.data ? `${disk.data.usedPercent.toFixed(1)}% usado · ${(disk.data.available / 1073741824).toFixed(2)} GiB disponíveis · consultado em ${date(disk.data.observedAt)}` : 'Indisponível'}</p>
        {disk.data && ['warning', 'critical'].includes(diskUsageLevel(disk.data.usedPercent)) && <p role="alert" className="text-amber-500">Uso de disco elevado. Consulte a infraestrutura do Supabase e o procedimento de recuperação.</p>}
        <p className="text-xs text-muted-foreground">O tamanho do banco não representa todo o disco usado, que inclui WAL e outros arquivos. A medição de disco requer credencial de servidor configurada.</p>
        <p>Último sucesso do catálogo: {date(data.operational.catalog_last_success)} · {data.operational.catalog_error ? 'Há erro registrado na sincronização' : 'Sem erro registrado'}</p>
        <p>Classificação do erro: {data.catalogExecution?.error_kind === 'gamma' ? 'Gamma identificada na mensagem' : data.catalogExecution?.error_kind === 'other_or_unknown' ? 'Outra origem ou não identificada' : data.catalogExecution ? 'Nenhum erro registrado' : 'Indisponível'} · Duração do último comando cron: {data.catalogExecution?.last_cron_duration_ms != null ? `${Math.round(data.catalogExecution.last_cron_duration_ms)} ms` : 'Indisponível'}</p>
        <p className="text-xs text-muted-foreground">A duração do cron mede o envio da requisição, não a execução completa da sincronização.</p>
        <p>Duração do último ciclo completo de mercados: {data.catalogExecution?.last_market_cycle_duration_ms != null ? `${(data.catalogExecution.last_market_cycle_duration_ms / 1000).toFixed(1)} s` : 'Ainda não registrada'} · Eventos: {data.catalogExecution?.last_event_cycle_duration_ms != null ? `${(data.catalogExecution.last_event_cycle_duration_ms / 1000).toFixed(1)} s` : 'Ainda não registrada'}</p>
        <p>Copy Trading: {data.operational.copy_active} estratégias ativas · {data.operational.copy_pending} sinais pendentes · verificação mais antiga: {date(data.operational.copy_oldest_check)}</p>
        <p>Portfólio: último sucesso {date(data.operational.snapshot_last_success)} · {data.operational.snapshot_failed_attempts} contas com tentativa posterior ao último sucesso</p>
        {data.operational.jobs.map(job => <p key={job.name}>{job.name}: {job.active ? 'Ativo' : 'Pausado'} · {date(job.last_run)} · {job.last_status ?? 'Sem resultado'}</p>)}
        <div className="border-t pt-3"><p className="font-semibold">Respostas HTTP dos workers</p>{!data.http ? <p>Métricas HTTP indisponíveis.</p> : data.http.length === 0 ? <p>Ainda não há chamadas registradas.</p> : data.http.map(item => <p key={item.job_name}>{item.job_name}: {item.status} · HTTP {item.status_code ?? 'indisponível'} · solicitado em {date(item.requested_at)}</p>)}</div>
        <p className="text-xs text-muted-foreground">Sinais pendentes podem aguardar aprovação manual. A execução do cron não confirma o sucesso da função HTTP.</p>
      </>}</CardContent></Card>
    </>}
  </div>;
}
