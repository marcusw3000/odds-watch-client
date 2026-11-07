import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemHealth } from '@/hooks/useSystemHealth';

const date = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem registro';

export function AdminSystemPage() {
  const { data, isLoading, isError, refetch, isFetching } = useSystemHealth();
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Sistema</h1><p className="text-muted-foreground">Disponibilidade e sincronização Polymarket</p></div><Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div>
    {isLoading ? <p>Carregando...</p> : isError || !data ? <p role="alert" className="text-destructive">Não foi possível carregar o monitoramento.</p> : <>
      <div className="grid gap-4 md:grid-cols-3">{[['Banco de dados', data.database ? 'Respondendo' : 'Indisponível'], ['Autenticação', data.auth ? 'Respondendo' : 'Indisponível'], ['Tempo das consultas', `${data.latencyMs} ms`]].map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle>Catálogo e agendamentos</CardTitle></CardHeader><CardContent className="space-y-4">{data.catalogError || !data.catalog ? <p role="alert" className="text-destructive">Dados administrativos do catálogo indisponíveis.</p> : <>
        <p>Mercados em cache: {data.catalog.market_count.toLocaleString('pt-BR')}</p><p>Atualização mais recente de um mercado: {date(data.catalog.latest_sync)}</p><p>Última verificação de encerramento: {date(data.catalog.latest_closure_check)}</p>
        {data.catalog.jobs.length ? data.catalog.jobs.map(job => <div className="border-t pt-3 text-sm" key={job.name}><p className="font-semibold">{job.name} · {job.active ? 'Ativo' : 'Pausado'}</p><p className="text-muted-foreground">Agendamento: {job.schedule} · Última execução: {date(job.last_run)} · {job.last_status ?? 'Sem resultado'}</p></div>) : <p>Nenhum agendamento encontrado.</p>}
        <p className="text-xs text-muted-foreground">O resultado do agendamento indica o envio da requisição; consulte os logs HTTP para confirmar a resposta da função. A atualização mais recente não garante cobertura completa da cache.</p>
      </>}</CardContent></Card>
    </>}
  </div>;
}
