import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Briefcase, FlaskConical, Search, Share2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePolymarketPaperTrading } from "@/hooks/usePolymarketPaperTrading";
import { usePaperPortfolioValue } from "@/hooks/usePaperPortfolioValue";
import { useMyPaperRanking } from "@/hooks/usePaperLeaderboard";
import { PaperTradeShareDialog } from "@/components/polymarket/PaperTradeShareDialog";
import type { PaperPurchaseShare } from "@/lib/paperPurchaseShare";

const formatUsd = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

export function PolymarketPaperPortfolioPage() {
  const navigate = useNavigate();
  const [sharePurchase, setSharePurchase] = useState<PaperPurchaseShare | null>(null);
  const [loadingShare, setLoadingShare] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chartPoints, setChartPoints] = useState<Array<{ time: number; value: number }>>([]);
  const { data, isLoading, error, isAuthenticated, reset } = usePolymarketPaperTrading();
  const valuation = usePaperPortfolioValue(data?.positions);
  const ranking = useMyPaperRanking();
  const positions = data?.positions ?? [];
  const totalInvested = positions.reduce((sum: number, position: any) => sum + (position.legacy_cost != null && position.verified_cost != null ? Number(position.legacy_cost) + Number(position.verified_cost) : Number(position.shares) * Number(position.average_price)), 0);
  const openProfit = data && valuation.total !== null && Number.isFinite(totalInvested) ? valuation.total - totalInvested : null;
  const roundId = data?.wallet?.round_id;

  useEffect(() => { setChartPoints([]); }, [roundId]);
  useEffect(() => {
    if (openProfit === null || !Number.isFinite(openProfit)) return;
    setChartPoints(points => [...points, { time: Date.now(), value: openProfit }].slice(-120));
  }, [openProfit, valuation.dataUpdatedAt, roundId]);

  if (!isAuthenticated) return <section className="container mx-auto max-w-3xl px-4 py-10"><Card><CardContent className="space-y-4 p-6"><h1 className="text-xl font-bold">Meu Portfólio</h1><p className="text-muted-foreground">Entre para acompanhar as operações simuladas.</p><Button onClick={() => navigate("/auth?returnTo=%2Fportfolio")}>Entrar</Button></CardContent></Card></section>;

  const balance = data?.wallet?.balance_usd == null ? null : Number(data.wallet.balance_usd);
  const trades = data?.trades ?? [];
  const filteredPositions = positions.map((position: any, index: number) => ({ position, value: valuation.values[index] ?? null })).filter(({ position }: any) => `${position.market_question} ${position.outcome_label}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));

  async function shareTrade(trade: any) {
    const price = Number(trade.price), shares = Number(trade.shares);
    if (trade.side !== "BUY" || !/^\d{1,20}$/.test(String(trade.market_id)) || !Number.isFinite(price) || price <= 0 || price > 1 || !Number.isFinite(shares) || shares <= 0 || typeof trade.outcome_label !== "string") {
      toast.error("Os dados desta compra estão indisponíveis para compartilhar."); return;
    }
    setLoadingShare(trade.id);
    let question: string | null = null, imageUrl: string | null = null;
    try {
      const response = await fetch(`/api/polymarket/market/${encodeURIComponent(trade.market_id)}/share`, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const market = await response.json();
        if (typeof market.question === "string" && market.question.trim()) question = market.question;
        if (typeof market.imageUrl === "string") imageUrl = market.imageUrl;
      }
    } catch { /* Use the saved position if public data is unavailable. */ }
    if (!question) question = positions.find((position: any) => position.market_id === trade.market_id)?.market_question ?? null;
    setLoadingShare(null);
    if (!question) { toast.error("Não foi possível carregar o mercado desta compra. Tente novamente."); return; }
    setSharePurchase({ marketId: trade.market_id, question, imageUrl, outcome: trade.outcome_label, shares, price });
  }

  return <section className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Briefcase className="h-6 w-6 text-primary" /> Meu Portfólio</h1><p className="mt-1 flex items-center gap-2 text-muted-foreground"><FlaskConical className="h-4 w-4 text-primary" /> Paper Trading Polymarket · USD virtual</p></div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/70 bg-secondary/55"><CardContent className="flex min-h-[220px] flex-col justify-between p-5"><div className="flex flex-wrap justify-between gap-5"><div><p className="text-sm text-muted-foreground">Portfólio</p><p className="mt-1 text-3xl font-bold tabular-nums">{isLoading || valuation.isValuationLoading ? 'Carregando...' : valuation.total === null ? 'Indisponível' : formatUsd(valuation.total)}</p><p className="mt-1 text-xs text-muted-foreground">Valor atual das posições simuladas</p></div><div className="text-right"><p className="text-sm text-muted-foreground">Disponível para simular</p><p className="mt-1 text-2xl font-semibold tabular-nums">{isLoading ? 'Carregando...' : balance === null || !Number.isFinite(balance) ? 'Indisponível' : formatUsd(balance)}</p></div></div><div className="flex flex-wrap gap-2 pt-5"><Button variant="secondary" asChild><Link to="/polymarket">Explorar mercados</Link></Button><Button variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>{reset.isPending ? 'Resetando...' : 'Resetar carteira virtual'}</Button></div></CardContent></Card>
      <Card className="border-border/70 bg-secondary/55"><CardContent className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-muted-foreground">Lucro / Prejuízo em aberto</p><p className={`mt-1 text-3xl font-bold tabular-nums ${openProfit === null ? '' : openProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{isLoading || valuation.isValuationLoading ? 'Carregando...' : openProfit === null ? 'Indisponível' : formatUsd(openProfit)}</p><p className="mt-1 text-xs text-muted-foreground">Valor atual das posições menos custo</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Realizado verificado</p><p className="mt-1 text-sm font-semibold tabular-nums">{ranking.isLoading ? 'Carregando...' : ranking.isError || !ranking.data ? 'Indisponível' : formatUsd(ranking.data.total_profit)}</p></div></div><div className="mt-5 h-24">{chartPoints.length < 2 ? <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">O gráfico acompanha o resultado em aberto enquanto esta página estiver aberta.</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartPoints}><defs><linearGradient id="paper-profit-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="time" hide /><YAxis domain={['auto','auto']} hide /><Tooltip formatter={(value: number) => [formatUsd(value), 'Resultado em aberto']} labelFormatter={(value) => new Date(Number(value)).toLocaleTimeString('pt-BR')} /><Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#paper-profit-gradient)" isAnimationActive={false} /></AreaChart></ResponsiveContainer>}</div><p className="mt-2 text-xs text-muted-foreground">Gráfico desta sessão. Vendas de posições anteriores à verificação não entram no realizado.</p></CardContent></Card>
    </div>
    <p className="text-xs text-muted-foreground">Valores simulados em USD. A cotação pública é uma estimativa e não garante preço de venda.</p>
    {(error || reset.error) && <p className="text-sm text-destructive">{error?.message ?? reset.error?.message}</p>}

    <Tabs defaultValue="active" className="w-full"><div className="flex flex-wrap items-center gap-3"><TabsList className="border border-border bg-background p-1"><TabsTrigger value="active">Posições</TabsTrigger><TabsTrigger value="history">Histórico de trades</TabsTrigger></TabsList><div className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Buscar posições" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar posições..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div></div>
      <TabsContent value="active" className="mt-6 space-y-2"><div className="hidden grid-cols-[minmax(0,1fr)_120px_110px_110px] gap-4 px-4 text-xs text-muted-foreground md:grid"><span>Mercado</span><span>Preço médio → atual</span><span>Custo</span><span className="text-right">Valor</span></div>{isLoading ? <p className="text-muted-foreground">Carregando posições...</p> : filteredPositions.length ? filteredPositions.map(({ position, value }: any) => <div key={position.id} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_120px_110px_110px] md:items-center"><div><p className="font-medium">{position.market_question}</p><p className="mt-1 text-xs text-muted-foreground">{position.outcome_label} · {Number(position.shares).toLocaleString('pt-BR', { maximumFractionDigits: 6 })} shares</p></div><div className="text-sm tabular-nums"><span className="md:hidden">Médio → atual: </span>{(Number(position.average_price) * 100).toFixed(1)}¢ → {value === null || Number(position.shares) <= 0 ? '—' : `${(value / Number(position.shares) * 100).toFixed(1)}¢`}</div><div className="text-sm tabular-nums"><span className="md:hidden">Custo: </span>{formatUsd(position.legacy_cost != null && position.verified_cost != null ? Number(position.legacy_cost) + Number(position.verified_cost) : Number(position.shares) * Number(position.average_price))}</div><div className="text-sm font-semibold tabular-nums md:text-right"><span className="md:hidden">Valor: </span>{valuation.isValuationLoading ? 'Carregando...' : value === null ? 'Indisponível' : formatUsd(value)}</div></div>) : <EmptyState text={search ? 'Nenhuma posição encontrada.' : 'Você não possui posições simuladas.'} />}</TabsContent>
      <TabsContent value="history" className="mt-6 space-y-2">{trades.length ? trades.map((trade: any) => <Card key={trade.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm"><div><span className="font-medium">{trade.side === "BUY" ? "Compra" : "Venda"} · {trade.outcome_label}</span>{trade.market_question && <p className="mt-1 text-muted-foreground">{trade.market_question}</p>}</div><dl className="flex flex-wrap gap-x-6 gap-y-2"><div><dt className="text-xs text-muted-foreground">Quantidade</dt><dd className="font-mono">{Number(trade.shares).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} shares</dd></div><div><dt className="text-xs text-muted-foreground">Preço por share</dt><dd className="font-mono">{(Number(trade.price) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 4 })}¢</dd></div><div><dt className="text-xs text-muted-foreground">Valor total</dt><dd className="font-mono font-semibold">{formatUsd(Number(trade.notional_usd))}</dd></div></dl>{trade.side === "BUY" && <Button variant="outline" size="sm" disabled={loadingShare !== null} onClick={() => void shareTrade(trade)}><Share2 className="mr-2 h-4 w-4" />{loadingShare === trade.id ? "Carregando..." : "Compartilhar card"}</Button>}</CardContent></Card>) : <EmptyState text="Nenhuma operação simulada ainda." />}</TabsContent>
    </Tabs>
    <PaperTradeShareDialog purchase={sharePurchase} onClose={() => setSharePurchase(null)} />
  </section>;
}

function EmptyState({ text }: { text: string }) { return <div className="py-16 text-center text-muted-foreground">{text}</div>; }
