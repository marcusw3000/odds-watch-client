import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Briefcase, FlaskConical, History, Share2, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePolymarketPaperTrading } from "@/hooks/usePolymarketPaperTrading";
import { PaperTradeShareDialog } from "@/components/polymarket/PaperTradeShareDialog";
import type { PaperPurchaseShare } from "@/lib/paperPurchaseShare";

const formatUsd = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

export function PolymarketPaperPortfolioPage() {
  const navigate = useNavigate();
  const [sharePurchase, setSharePurchase] = useState<PaperPurchaseShare | null>(null);
  const [loadingShare, setLoadingShare] = useState<string | null>(null);
  const { data, isLoading, error, isAuthenticated, reset } = usePolymarketPaperTrading();

  if (!isAuthenticated) return <section className="container mx-auto max-w-3xl px-4 py-10"><Card><CardContent className="space-y-4 p-6"><h1 className="text-xl font-bold">Meu Portfólio</h1><p className="text-muted-foreground">Entre para acompanhar as operações simuladas.</p><Button onClick={() => navigate("/auth?returnTo=%2Fportfolio")}>Entrar</Button></CardContent></Card></section>;

  const balance = Number(data?.wallet?.balance_usd ?? 0);
  const positions = data?.positions ?? [];
  const trades = data?.trades ?? [];
  const totalInvested = positions.reduce((sum: number, position: any) => sum + Number(position.shares) * Number(position.average_price), 0);

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
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Briefcase className="h-6 w-6 text-primary" /> Meu Portfólio</h1><p className="mt-1 flex items-center gap-2 text-muted-foreground"><FlaskConical className="h-4 w-4 text-primary" /> Paper Trading Polymarket · USD virtual</p></div><div className="flex gap-2"><Button variant="outline" asChild><Link to="/polymarket">Explorar mercados</Link></Button><Button variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>{reset.isPending ? "Resetando..." : "Resetar carteira"}</Button></div></div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Metric icon={Wallet} label="Saldo disponível" value={isLoading ? "Carregando..." : formatUsd(balance)} color="text-primary" /><Metric icon={TrendingUp} label="Total investido" value={formatUsd(totalInvested)} color="text-warning" /><Metric icon={History} label="Operações" value={String(trades.length)} color="text-success" /></div>
    {(error || reset.error) && <p className="text-sm text-destructive">{error?.message ?? reset.error?.message}</p>}

    <Tabs defaultValue="active" className="w-full"><TabsList className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0"><TabsTrigger value="active" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent">Contratos ativos</TabsTrigger><TabsTrigger value="history" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent">Histórico de trades</TabsTrigger></TabsList>
      <TabsContent value="active" className="mt-6 space-y-3">{isLoading ? <p className="text-muted-foreground">Carregando posições...</p> : positions.length ? positions.map((position: any) => <Card key={position.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{position.market_question}</p><p className="text-sm text-muted-foreground">{position.outcome_label} · {Number(position.shares).toFixed(2)} shares</p></div><div className="text-right text-sm"><p className="text-muted-foreground">Preço médio</p><p className="font-mono font-semibold">{(Number(position.average_price) * 100).toFixed(1)}¢</p></div></CardContent></Card>) : <EmptyState text="Você não possui contratos ativos." />}</TabsContent>
      <TabsContent value="history" className="mt-6 space-y-2">{trades.length ? trades.map((trade: any) => <Card key={trade.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm"><div><span className="font-medium">{trade.side === "BUY" ? "Compra" : "Venda"} · {trade.outcome_label}</span>{trade.market_question && <p className="mt-1 text-muted-foreground">{trade.market_question}</p>}</div><dl className="flex flex-wrap gap-x-6 gap-y-2"><div><dt className="text-xs text-muted-foreground">Quantidade</dt><dd className="font-mono">{Number(trade.shares).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} shares</dd></div><div><dt className="text-xs text-muted-foreground">Preço por share</dt><dd className="font-mono">{(Number(trade.price) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 4 })}¢</dd></div><div><dt className="text-xs text-muted-foreground">Valor total</dt><dd className="font-mono font-semibold">{formatUsd(Number(trade.notional_usd))}</dd></div></dl>{trade.side === "BUY" && <Button variant="outline" size="sm" disabled={loadingShare !== null} onClick={() => void shareTrade(trade)}><Share2 className="mr-2 h-4 w-4" />{loadingShare === trade.id ? "Carregando..." : "Compartilhar card"}</Button>}</CardContent></Card>) : <EmptyState text="Nenhuma operação simulada ainda." />}</TabsContent>
    </Tabs>
    <PaperTradeShareDialog purchase={sharePurchase} onClose={() => setSharePurchase(null)} />
  </section>;
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Wallet; label: string; value: string; color: string }) {
  return <Card><CardContent className="flex items-start justify-between p-5"><div><p className="mb-1 text-sm text-muted-foreground">{label}</p><p className={`font-mono text-2xl font-bold ${color}`}>{value}</p></div><div className="rounded-lg bg-muted p-3"><Icon className={`h-5 w-5 ${color}`} /></div></CardContent></Card>;
}

function EmptyState({ text }: { text: string }) { return <div className="py-16 text-center text-muted-foreground">{text}</div>; }
