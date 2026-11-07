import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { usePaperCopyTrading } from "@/hooks/usePaperCopyTrading";

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const message = (error: unknown) => error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "Não foi possível concluir a ação.";
const statusLabel: Record<string, string> = { pending: "Aguardando aprovação", approved: "Aguardando processamento", executed: "Copiada", rejected: "Recusada", skipped: "Ignorada" };

export function PaperCopyTradingPage() {
  const [params] = useSearchParams(); const { user } = useAuth(); const copy = usePaperCopyTrading();
  const [mode, setMode] = useState("manual"), [total, setTotal] = useState(""), [perTrade, setPerTrade] = useState("");
  const source = params.get("source"), id = params.get("trader") ?? "", name = (params.get("name") ?? "").trim().slice(0, 100);
  const valid = source === "polymarket" ? /^0x[0-9a-f]{40}$/i.test(id) : source === "paper" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const strategies = copy.data?.strategies ?? [], signals = copy.data?.signals ?? [];
  const selected = strategies.find(s => s.source_kind === source && s.source_id.toLowerCase() === id.toLowerCase());
  useEffect(() => {
    setMode(selected?.mode ?? "manual");
    setTotal(selected ? String(selected.total_limit) : "");
    setPerTrade(selected ? String(selected.per_trade_limit) : "");
  }, [source, id, selected?.id, selected?.mode, selected?.total_limit, selected?.per_trade_limit]);
  const run = async (action: () => Promise<unknown>, success: string) => { try { await action(); toast.success(success); } catch (error) { toast.error(message(error)); } };
  const save = async () => {
    const limit = Number(total), each = Number(perTrade);
    if (!valid || !source || !Number.isFinite(limit) || !Number.isFinite(each) || limit <= 0 || limit > 1_000_000 || each <= 0 || each > limit) { toast.error("Informe limites válidos; o limite por operação não pode superar o total."); return; }
    await run(() => copy.save.mutateAsync({ kind: source, source: id, name: name || id, mode, total: limit, perTrade: each }), "Estratégia ativada no simulador.");
  };
  return <section className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
    <Link to="/leaderboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Voltar ao ranking</Link>
    <div><p className="flex items-center gap-2 text-sm text-primary"><FlaskConical className="h-4 w-4" />Paper Trading</p><h1 className="mt-1 text-3xl font-bold">Copy Trading simulado</h1><p className="mt-2 text-muted-foreground">Copie novas compras com saldo virtual. O preço e a liquidez podem mudar antes da execução.</p></div>
    {valid && <section className="space-y-4 rounded-xl border border-border bg-card p-5"><div><h2 className="text-lg font-semibold">Configurar trader</h2><p className="break-all text-sm text-muted-foreground">{name || id} · {source === "polymarket" ? "Polymarket" : "Paper Trading"}</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm">Limite total (USD virtual)<Input type="number" min="0.01" max="1000000" step="0.01" value={total} onChange={event => setTotal(event.target.value)} placeholder="Ex.: 100" /></label><label className="space-y-1 text-sm">Limite por operação (USD virtual)<Input type="number" min="0.01" step="0.01" value={perTrade} onChange={event => setPerTrade(event.target.value)} placeholder="Ex.: 10" /></label></div><label className="block space-y-1 text-sm">Modo de cópia<select value={mode} onChange={event => setMode(event.target.value)} className="block h-10 w-full rounded-md border border-input bg-background px-3 sm:max-w-xs"><option value="manual">Manual: solicitar aprovação</option><option value="automatic">Automático</option></select></label><p className="text-xs text-muted-foreground">O limite total é o valor acumulado das compras copiadas nesta rodada. As posições anteriores à ativação não são copiadas. O preço máximo aceito é o preço de origem mais 3 centavos por share.</p>{user ? <Button disabled={copy.save.isPending} onClick={save}>Ativar estratégia</Button> : <Button asChild variant="outline"><Link to={`/auth?returnTo=${encodeURIComponent(`/copy-trading?${params.toString()}`)}`}>Entrar para configurar</Link></Button>}</section>}
    {!user ? <p className="rounded-xl border border-border p-5 text-muted-foreground">Entre na sua conta para acompanhar suas estratégias.</p> : copy.isLoading ? <p role="status">Carregando estratégias...</p> : copy.isError ? <div role="alert" className="space-y-2 rounded-xl border border-destructive/50 p-5"><p>Não foi possível carregar suas estratégias.</p><Button variant="outline" onClick={() => copy.refetch()}>Tentar novamente</Button></div> : <>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Traders copiados</h2>{!strategies.length ? <p className="rounded-xl border border-border p-5 text-muted-foreground">Nenhuma estratégia configurada. Escolha um trader no ranking.</p> : strategies.map(s => {
        const realized = (copy.data?.positions ?? []).filter(p => p.strategy_id === s.id && p.round_id === s.round_id).reduce((sum,p) => sum + Number(p.realized_usd), 0);
        return <article key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5"><div><h3 className="font-semibold">{s.source_name}</h3><p className="text-sm text-muted-foreground">{s.source_kind === "paper" ? "Paper Trading" : "Polymarket"} · {s.mode === "manual" ? "Manual" : "Automático"} · {s.active ? "Ativa" : "Pausada"}</p><p className="mt-2 text-sm">Compras copiadas: {usd(Number(s.spent_usd))} de {usd(Number(s.total_limit))} · Lucro realizado: <span className={realized >= 0 ? "text-green-500" : "text-red-500"}>{usd(realized)}</span></p><p className="text-xs text-muted-foreground">O lucro realizado considera vendas proporcionais das shares copiadas.</p>{s.monitoring_error && <p role="status" className="mt-2 text-xs text-amber-500">{s.monitoring_error}</p>}</div><div className="flex gap-2"><Button variant="outline" asChild><Link to={`/copy-trading?${new URLSearchParams({ source: s.source_kind, trader: s.source_id, name: s.source_name })}`}>Editar limites</Link></Button><Button variant="outline" disabled={copy.setActive.isPending} onClick={() => run(() => copy.setActive.mutateAsync({ id: s.id, active: !s.active }), s.active ? "Estratégia pausada." : "Estratégia retomada.")}>{s.active ? "Pausar" : "Retomar"}</Button></div></article>;
      })}</section>
      <section className="space-y-3"><h2 className="text-xl font-semibold">Atividade de cópia</h2>{!signals.length ? <p className="rounded-xl border border-border p-5 text-muted-foreground">Nenhuma atividade de cópia ainda.</p> : signals.map(signal => <article key={signal.id} className="space-y-2 rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{signal.question}</strong><span className="text-sm text-muted-foreground">{statusLabel[signal.status] ?? signal.status}</span></div><p className="text-sm text-muted-foreground">{strategies.find(s => s.id === signal.strategy_id)?.source_name ?? "Trader"} · {signal.side === "SELL" ? "Venda" : "Compra"} · {signal.outcome} · origem {usd(Number(signal.source_notional))}{signal.side === "SELL" && signal.sell_fraction != null ? ` · ${(Number(signal.sell_fraction)*100).toFixed(1)}% da posição` : ""} · {new Date(signal.created_at).toLocaleString("pt-BR")}</p>{signal.reason && <p className="text-sm text-muted-foreground">{signal.reason}</p>}{signal.status === "pending" && <div className="flex gap-2"><Button size="sm" disabled={copy.respond.isPending} onClick={() => run(() => copy.respond.mutateAsync({ id: signal.id, accept: true }), "Aprovação registrada; a cópia será processada em breve.")}>Aceitar cópia</Button><Button variant="outline" size="sm" disabled={copy.respond.isPending} onClick={() => run(() => copy.respond.mutateAsync({ id: signal.id, accept: false }), "Cópia recusada.")}>Recusar</Button></div>}</article>)}</section>
    </>}
  </section>;
}
