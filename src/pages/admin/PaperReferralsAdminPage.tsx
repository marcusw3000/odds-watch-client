import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PaperReferralsAdminPage() {
  const stats = useQuery({ queryKey: ['paper-referrals-admin'], queryFn: async () => {
    const { data, error } = await (supabase as any).rpc('get_paper_referral_admin_stats');
    if (error) throw error;
    if (!data?.[0]) throw new Error('Estatísticas indisponíveis.');
    return data[0] as { total_codes: number; total_referred: number; active_referred: number; verified_trades: number };
  } });
  return <section className="space-y-6"><div><h1 className="text-3xl font-bold">Convites do simulador</h1><p className="mt-2 text-muted-foreground">Programa recreativo, sem comissões ou descontos. Métricas de operações consideram a rodada atual.</p></div>
    {stats.isLoading ? <p>Carregando...</p> : stats.isError || !stats.data ? <div><p role="alert">Não foi possível carregar os convites.</p><Button variant="outline" onClick={() => stats.refetch()}>Tentar novamente</Button></div> : <div className="grid gap-4 md:grid-cols-4">{[['Códigos gerados',stats.data.total_codes],['Contas vinculadas',stats.data.total_referred],['Participantes ativos',stats.data.active_referred],['Operações verificadas',stats.data.verified_trades]].map(([label,value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></CardContent></Card>)}</div>}
  </section>;
}
