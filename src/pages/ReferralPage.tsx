import { useQuery } from '@tanstack/react-query';
import { Copy, Gift, Share2, Users, Activity, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getPaperReferralCode, getPaperReferralStats, getPaperCopyReferralSummary } from '@/services/PaperReferralService';

export function ReferralPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const code = useQuery({ queryKey: ['paper-referral-code', user?.id], enabled: Boolean(user), queryFn: getPaperReferralCode });
  const stats = useQuery({ queryKey: ['paper-referral-stats', user?.id], enabled: Boolean(user), queryFn: getPaperReferralStats });
  const commissions = useQuery({ queryKey: ['paper-copy-referral', user?.id], enabled: Boolean(user), queryFn: getPaperCopyReferralSummary, refetchInterval: 15000 });
  const usd = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(value);

  const copy = async (text: string, description: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: 'Copiado!', description }); }
    catch { toast({ title: 'Não foi possível copiar', description: 'Tente novamente.', variant: 'destructive' }); }
  };
  const link = code.data && typeof window !== 'undefined' ? `${window.location.origin}/auth?ref=${encodeURIComponent(code.data)}` : '';
  const share = async () => {
    if (!link) return;
    if (!navigator.share) { await copy(link, 'Link de convite copiado.'); return; }
    try { await navigator.share({ title: 'Convite para o simulador', text: 'Conheça o simulador.', url: link }); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast({ title: 'Não foi possível compartilhar', variant: 'destructive' }); }
  };

  return <section className="container mx-auto max-w-6xl px-4 py-8">
    <div className="mb-8"><h1 className="mb-2 text-3xl font-bold">Convites para o simulador</h1><p className="text-muted-foreground">Convide amigos e acompanhe a participação deles no Simulador Polymarket.</p></div>
    <Card className="mb-8 border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Seu código de convite</CardTitle><CardDescription>O mesmo código pode ser usado por várias pessoas. Você recebe 10% do lucro elegível de Copy Trading dos indicados, em saldo virtual.</CardDescription></CardHeader><CardContent>
      {code.isLoading ? <Skeleton className="h-12 w-48" /> : code.isError || !code.data ? <div className="space-y-3"><p role="alert" className="text-sm text-destructive">Convites temporariamente indisponíveis.</p><Button variant="outline" onClick={() => code.refetch()}>Tentar novamente</Button></div> : <div className="flex flex-wrap items-center gap-3"><span className="rounded-lg border border-primary/30 bg-background px-5 py-3 font-mono text-xl font-bold tracking-wider text-primary">{code.data}</span><Button variant="outline" onClick={() => copy(code.data, 'Código de convite copiado.')}><Copy className="mr-2 h-4 w-4" /> Copiar código</Button><Button variant="outline" onClick={() => copy(link, 'Link de convite copiado.')}><Copy className="mr-2 h-4 w-4" /> Copiar link</Button><Button onClick={share}><Share2 className="mr-2 h-4 w-4" /> Compartilhar</Button></div>}
    </CardContent></Card>
    {stats.isError ? <Card><CardContent className="space-y-3 p-6"><p role="alert" className="text-destructive">Não foi possível carregar as estatísticas de convites.</p><Button variant="outline" onClick={() => stats.refetch()}>Tentar novamente</Button></CardContent></Card> : <div className="mb-8 grid gap-4 md:grid-cols-3">
      {[{ label: 'Pessoas convidadas', value: stats.data?.total_referred, icon: Users, detail: 'contas vinculadas ao seu convite' }, { label: 'Participantes ativos', value: stats.data?.active_referred, icon: CheckCircle, detail: 'fizeram operação verificada na rodada atual' }, { label: 'Operações verificadas', value: stats.data?.verified_trades, icon: Activity, detail: 'operações simuladas na rodada atual' }].map(item => <Card key={item.label}><CardContent className="p-6"><div className="mb-3 flex items-center justify-between text-sm"><span>{item.label}</span><item.icon className="h-4 w-4 text-muted-foreground" /></div>{stats.isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{item.value ?? '—'}</p>}<p className="mt-2 text-xs text-muted-foreground">{item.detail}</p></CardContent></Card>)}
    </div>}
    <Card className="mb-8"><CardHeader><CardTitle>Comissões virtuais de Copy Trading</CardTitle><CardDescription>10% do novo lucro realizado elegível, após compensar prejuízos. Não é dinheiro real.</CardDescription></CardHeader><CardContent>{commissions.isLoading ? <Skeleton className="h-8 w-32" /> : commissions.isError ? <p role="alert" className="text-destructive">Não foi possível carregar as comissões.</p> : <><p className="text-2xl font-bold">{usd(Number(commissions.data?.received_usd ?? 0))}</p><p className="text-xs text-muted-foreground">Total histórico recebido; o reset da carteira reinicia o saldo.</p>{!!commissions.data?.history.length && <ul className="mt-4 space-y-2">{commissions.data.history.map((entry, index) => <li key={`${entry.created_at}-${index}`} className="flex justify-between text-sm"><span>{new Date(entry.created_at).toLocaleString('pt-BR')}</span><span>{usd(Number(entry.commission_usd))}</span></li>)}</ul>}</>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Como funciona</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>1. Compartilhe seu código ou link com quantas pessoas desejar.</p><p>2. O convite pode ser vinculado a uma conta criada nos últimos sete dias, antes da primeira operação simulada.</p><p>3. Quando uma pessoa convidada fizer uma operação verificada, ela será contabilizada como participante ativa.</p><p>Após a implantação, vendas de posições copiadas geram repasse de 10% apenas sobre o novo lucro acumulado que superar o maior lucro já considerado na rodada. Prejuízos são compensados; o valor é descontado do indicado e creditado em saldo virtual ao indicador.</p><p>As métricas refletem a rodada atual e podem mudar após reset. As comissões são recreativas, sem saque, e não contam como lucro no ranking. Os dados são agregados para preservar a privacidade.</p></CardContent></Card>
  </section>;
}
