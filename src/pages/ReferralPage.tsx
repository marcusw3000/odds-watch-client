import { useQuery } from '@tanstack/react-query';
import { Copy, Gift, Share2, Users, Activity, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getPaperReferralCode, getPaperReferralStats } from '@/services/PaperReferralService';

export function ReferralPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const code = useQuery({ queryKey: ['paper-referral-code', user?.id], enabled: Boolean(user), queryFn: getPaperReferralCode });
  const stats = useQuery({ queryKey: ['paper-referral-stats', user?.id], enabled: Boolean(user), queryFn: getPaperReferralStats });

  const copy = async (text: string, description: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: 'Copiado!', description }); }
    catch { toast({ title: 'Não foi possível copiar', description: 'Tente novamente.', variant: 'destructive' }); }
  };
  const link = code.data && typeof window !== 'undefined' ? `${window.location.origin}/auth?ref=${encodeURIComponent(code.data)}` : '';
  const share = async () => {
    if (!link) return;
    if (!navigator.share) { await copy(link, 'Link de convite copiado.'); return; }
    try { await navigator.share({ title: 'Convite para o simulador', text: 'Conheça o simulador Paper Trading.', url: link }); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast({ title: 'Não foi possível compartilhar', variant: 'destructive' }); }
  };

  return <section className="container mx-auto max-w-6xl px-4 py-8">
    <div className="mb-8"><h1 className="mb-2 text-3xl font-bold">Convites para o simulador</h1><p className="text-muted-foreground">Convide amigos e acompanhe a participação deles no Paper Trading Polymarket.</p></div>
    <Card className="mb-8 border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Seu código de convite</CardTitle><CardDescription>O mesmo código pode ser usado por várias pessoas. Convites são recreativos: não oferecem desconto, comissão ou dinheiro.</CardDescription></CardHeader><CardContent>
      {code.isLoading ? <Skeleton className="h-12 w-48" /> : code.isError || !code.data ? <div className="space-y-3"><p role="alert" className="text-sm text-destructive">Convites temporariamente indisponíveis.</p><Button variant="outline" onClick={() => code.refetch()}>Tentar novamente</Button></div> : <div className="flex flex-wrap items-center gap-3"><span className="rounded-lg border border-primary/30 bg-background px-5 py-3 font-mono text-xl font-bold tracking-wider text-primary">{code.data}</span><Button variant="outline" onClick={() => copy(code.data, 'Código de convite copiado.')}><Copy className="mr-2 h-4 w-4" /> Copiar código</Button><Button variant="outline" onClick={() => copy(link, 'Link de convite copiado.')}><Copy className="mr-2 h-4 w-4" /> Copiar link</Button><Button onClick={share}><Share2 className="mr-2 h-4 w-4" /> Compartilhar</Button></div>}
    </CardContent></Card>
    {stats.isError ? <Card><CardContent className="space-y-3 p-6"><p role="alert" className="text-destructive">Não foi possível carregar as estatísticas de convites.</p><Button variant="outline" onClick={() => stats.refetch()}>Tentar novamente</Button></CardContent></Card> : <div className="mb-8 grid gap-4 md:grid-cols-3">
      {[{ label: 'Pessoas convidadas', value: stats.data?.total_referred, icon: Users, detail: 'contas vinculadas ao seu convite' }, { label: 'Participantes ativos', value: stats.data?.active_referred, icon: CheckCircle, detail: 'fizeram operação verificada na rodada atual' }, { label: 'Operações verificadas', value: stats.data?.verified_trades, icon: Activity, detail: 'operações simuladas na rodada atual' }].map(item => <Card key={item.label}><CardContent className="p-6"><div className="mb-3 flex items-center justify-between text-sm"><span>{item.label}</span><item.icon className="h-4 w-4 text-muted-foreground" /></div>{stats.isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{item.value ?? '—'}</p>}<p className="mt-2 text-xs text-muted-foreground">{item.detail}</p></CardContent></Card>)}
    </div>}
    <Card><CardHeader><CardTitle>Como funciona</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>1. Compartilhe seu código ou link com quantas pessoas desejar.</p><p>2. O convite pode ser vinculado a uma conta criada nos últimos sete dias, antes da primeira operação simulada.</p><p>3. Quando uma pessoa convidada fizer uma operação verificada, ela será contabilizada como participante ativa.</p><p>As métricas de operações refletem a rodada atual de cada participante e podem mudar se a carteira dele for reiniciada. Os dados são agregados para preservar a privacidade.</p></CardContent></Card>
  </section>;
}
