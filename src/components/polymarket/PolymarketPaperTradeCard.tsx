import { useRef, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePolymarketPaperTrading } from "@/hooks/usePolymarketPaperTrading";
import type { PolymarketMarket } from "@/types/polymarket";
import type { PolymarketMarketAnalytics } from "@/types/polymarket";
import { previewPaperExecution } from "@/lib/paperExecution";
import { PaperTradeShareDialog } from "./PaperTradeShareDialog";
import { paperPurchaseShare, type PaperPurchaseShare } from "@/lib/paperPurchaseShare";

export function PolymarketPaperTradeCard({ market, analytics, selectedOutcome, onSelectOutcome }: {
  market: PolymarketMarket;
  analytics: PolymarketMarketAnalytics | null;
  selectedOutcome: string | null;
  onSelectOutcome: (label: string) => void;
}) {
  const navigate = useNavigate();
  const [shares, setShares] = useState("10");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [sharePurchase, setSharePurchase] = useState<PaperPurchaseShare | null>(null);
  const pendingRequest = useRef<{ fingerprint: string; requestId: string; limitPrice: number } | null>(null);
  const { data, isAuthenticated, userId, trade, reset, isLoading, error } = usePolymarketPaperTrading();
  const outcome = market.outcomes.find((item) => item.label === selectedOutcome) ?? market.outcomes[0];
  const amount = Number(shares);
  const selectedBook = analytics?.outcomeLabel === outcome?.label ? analytics : null;
  const preview = selectedBook ? previewPaperExecution(side === "BUY" ? selectedBook.asks : selectedBook.bids, amount, side) : null;
  const price = preview?.complete ? Number(preview.price.toFixed(6)) : NaN;
  const closed = market.status === "closed";
  const canSubmit = !closed && Boolean(outcome) && Number.isFinite(amount) && amount > 0 && Number.isFinite(price) && price > 0 && price <= 1;
  const balance = data?.wallet?.balance_usd;

  function submit() {
    if (!canSubmit || !outcome || trade.isPending) return;
    if (!isAuthenticated) {
      const returnTo = `/polymarket/market/${market.id}?outcome=${encodeURIComponent(outcome.label)}`;
      navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    const roundId = data?.wallet?.round_id;
    if (typeof roundId !== "string") return;
    const fingerprint = JSON.stringify([market.id, outcome.label, side, amount, roundId]);
    const storageKey = `paper-pending:${userId}`;
    if (!pendingRequest.current) {
      try {
        const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        if (stored?.fingerprint === fingerprint && typeof stored.requestId === "string" && typeof stored.limitPrice === "number") pendingRequest.current = stored;
      } catch { /* Storage may be unavailable. */ }
    }
    if (pendingRequest.current?.fingerprint !== fingerprint) pendingRequest.current = { fingerprint, requestId: crypto.randomUUID(), limitPrice: side === "BUY" ? Math.min(1, Number((price * 1.05).toFixed(6))) : Math.max(0.000001, Number((price * 0.95).toFixed(6))) };
    try { sessionStorage.setItem(storageKey, JSON.stringify(pendingRequest.current)); } catch { /* Retry remains safe while this page stays open. */ }
    trade.mutate({ marketId: market.id, outcome: outcome.label, side, shares: amount, roundId, requestId: pendingRequest.current.requestId, limitPrice: pendingRequest.current.limitPrice }, {
      onSuccess: (result) => {
        pendingRequest.current = null;
        try { sessionStorage.removeItem(storageKey); } catch { /* no storage */ }
        const purchase = paperPurchaseShare(market, outcome.label, side, amount, result);
        if (purchase) setSharePurchase(purchase);
      },
      onError: (error) => { if (error.message.startsWith("O preço mudou além do limite")) { pendingRequest.current = null; try { sessionStorage.removeItem(storageKey); } catch { /* no storage */ } } },
    });
  }

  return (
    <><section aria-label="Painel de paper trading" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4 text-primary" /> Paper Trading <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Simulado</span></div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{market.question}</p>
      </div>
      <div className="space-y-5 p-4">
        <div className="flex gap-5 border-b border-border text-sm font-semibold" role="group" aria-label="Tipo de operação">
          {(["BUY", "SELL"] as const).map((value) => <button key={value} type="button" onClick={() => setSide(value)} aria-pressed={side === value} className={`border-b-2 pb-2 ${side === value ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>{value === "BUY" ? "Comprar" : "Vender"}</button>)}
        </div>
        <div><p className="mb-2 text-xs font-medium text-muted-foreground">Resultado</p><div className="grid grid-cols-2 gap-2">{market.outcomes.map((item, index) => <button key={`${item.label}-${index}`} type="button" onClick={() => onSelectOutcome(item.label)} aria-pressed={outcome?.label === item.label} className={`rounded-lg border px-2 py-3 text-sm font-semibold transition-colors ${outcome?.label === item.label ? index === 0 ? "border-emerald-500/50 bg-emerald-600 text-white" : "border-rose-500/50 bg-rose-700 text-white" : "border-border bg-background/40 text-muted-foreground hover:text-foreground"}`}>{item.label} {item.price != null && Number.isFinite(Number(item.price)) ? `${(Number(item.price) * 100).toFixed(1)}¢` : "—"}</button>)}</div></div>
        <label className="block text-sm font-semibold" htmlFor="paper-shares">Quantidade de shares</label>
        <Input id="paper-shares" type="number" min="0.01" step="0.01" value={shares} onChange={(event) => setShares(event.target.value)} className="text-right text-lg" />
        <div className="flex justify-between text-sm text-muted-foreground"><span>{side === "BUY" ? "Custo estimado" : "Valor estimado"}</span><span className="font-medium text-foreground">{canSubmit ? `US$ ${(amount * price).toFixed(2)}` : "—"}</span></div>
        {preview?.complete && <p className="text-xs text-muted-foreground">Preço médio simulado: {(price * 100).toFixed(2)}¢ por share, com base nas ofertas visíveis. Sem taxas.</p>}
        {!closed && (!preview || !preview.complete) && <p className="text-xs text-muted-foreground">{preview ? `Liquidez visível insuficiente: ${preview.available.toFixed(2)} shares disponíveis.` : "Livro de ofertas indisponível para esta operação."}</p>}
        <Button className="w-full" disabled={!canSubmit || trade.isPending || (isAuthenticated && !data?.wallet?.round_id)} onClick={submit}>{trade.isPending ? "Registrando..." : isAuthenticated ? `${side === "BUY" ? "Comprar" : "Vender"} no simulador` : "Entrar para simular"}</Button>
        {closed && <p className="text-sm text-muted-foreground">Este mercado está encerrado; operações simuladas estão indisponíveis.</p>}
        {isAuthenticated && <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><Link className="hover:text-primary" to="/polymarket/paper">Saldo virtual: {isLoading ? "Carregando..." : balance == null ? "Indisponível" : `US$ ${Number(balance).toFixed(2)}`}</Link><Button variant="ghost" size="sm" disabled={reset.isPending} onClick={() => reset.mutate()} aria-label="Resetar carteira virtual"><RotateCcw className="h-4 w-4" /></Button></div>}
        {trade.isSuccess && <p role="status" className="text-sm text-emerald-400">Operação simulada registrada.</p>}
        {(trade.error || error || reset.error) && <p role="alert" className="text-sm text-destructive">{(trade.error || error || reset.error)?.message}</p>}
        <p className="text-xs leading-relaxed text-muted-foreground">Valores virtuais. O servidor confirma o livro e aceita uma variação de até 5% do preço estimado. Nenhuma ordem é enviada à Polymarket.</p>
      </div>
    </section><PaperTradeShareDialog purchase={sharePurchase} onClose={() => setSharePurchase(null)} /></>
  );
}
