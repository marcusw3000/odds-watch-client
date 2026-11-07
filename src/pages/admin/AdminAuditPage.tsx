import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminAuditLogs } from '@/hooks/useAdminEvents';

export function AdminAuditPage() {
  const { data, isLoading, isError, refetch } = useAdminAuditLogs();
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Auditoria</h1><p className="text-muted-foreground">Registros administrativos disponíveis.</p></div>
    <Card><CardHeader><CardTitle>Atividade recente</CardTitle></CardHeader><CardContent>
      {isLoading ? <p>Carregando...</p> : isError ? <div role="alert" className="text-destructive">Não foi possível carregar os registros. <button className="underline" onClick={() => void refetch()}>Tentar novamente</button></div> : !data?.length ? <p className="text-muted-foreground">Nenhum registro disponível.</p> : <div className="space-y-3">{data.map(log => <div key={log.id} className="flex flex-wrap justify-between gap-2 border-b pb-3 text-sm"><span className="font-medium">{log.action}</span><span className="text-muted-foreground">{new Date(log.created_at).toLocaleString('pt-BR')}</span></div>)}</div>}
    </CardContent></Card>
  </div>;
}
