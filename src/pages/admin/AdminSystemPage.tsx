import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemHealth } from '@/hooks/useSystemHealth';

const date = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem registro';

export function AdminSystemPage() {
  const { data, isLoading, isError, refetch, isFetching } = useSystemHealth();
  const latestSync = data?.catalog?.latest_sync ? Date.parse(data.catalog.latest_sync) : NaN;
  const cacheAgeMinutes = Number.isFinite(latestSync) ? Math.max(0, Math.floor((Date.now() - latestSync) / 60000)) : null;
  const operational = data?.operational;
  const operationalAlerts = operational ? [
    operational.catalog_error ? 'A sincronização do catálogo registrou um erro. Consulte os logs da função.' : null,
    operational.copy_active > 0 && operational.copy_oldest_check && Date.now() - Date.parse(operational.copy_oldest_check) > 15 * 60_000 ? 'Há estratégias de Copy Trading sem verificação há mais de 15 minutos.' : null,
    operational.jobs.some(job => job.active && job.last_status === 'failed') ? 'Um agendamento registrou falha na última execução.' : null,
  ].filter((message): message is string => Boolean(message)) : [];
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
        <p className="text-xs text-muted-foreground">O tamanho do banco não representa todo o disco usado, que inclui WAL e outros arquivos. Consulte o painel do Supabase para capacidade e percentual.</p>
        <p>Último sucesso do catálogo: {date(data.operational.catalog_last_success)} · {data.operational.catalog_error ? 'Há erro registrado na sincronização' : 'Sem erro registrado'}</p>
        <p>Copy Trading: {data.operational.copy_active} estratégias ativas · {data.operational.copy_pending} sinais pendentes · verificação mais antiga: {date(data.operational.copy_oldest_check)}</p>
        <p>Portfólio: último sucesso {date(data.operational.snapshot_last_success)} · {data.operational.snapshot_failed_attempts} contas com tentativa posterior ao último sucesso</p>
        {data.operational.jobs.map(job => <p key={job.name}>{job.name}: {job.active ? 'Ativo' : 'Pausado'} · {date(job.last_run)} · {job.last_status ?? 'Sem resultado'}</p>)}
        <p className="text-xs text-muted-foreground">Sinais pendentes podem aguardar aprovação manual. A execução do cron não confirma o sucesso da função HTTP.</p>
      </>}</CardContent></Card>
    </>}
  </div>;
}
