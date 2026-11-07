import { useState } from "react";
import { ArrowLeft, ChartNoAxesCombined, Clock, ExternalLink, Trophy } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PolymarketFavoriteButton } from "@/components/polymarket/PolymarketFavoriteButton";
import { PolymarketPaperTradeCard } from "@/components/polymarket/PolymarketPaperTradeCard";
import { usePolymarketMarketStream } from "@/hooks/usePolymarketMarketStream";
import type { PolymarketMarket, PolymarketMarketAnalytics } from "@/types/polymarket";
import type { FxQuote } from "@/types/fx";
import type { MarketInsights } from "@/services/PolymarketInsights.server";
import type { PolymarketPublicComment } from "@/services/PolymarketPublicComments.server";
import { PolymarketEventComments } from "@/components/polymarket/PolymarketEventComments";

const usd = (value: string | null) => value !== null && Number.isFinite(Number(value))
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: Number(value) >= 1000 ? "compact" : "standard", maximumFractionDigits: 2 }).format(Number(value)) : "—";
const probability = (value: string | null) => value !== null && Number.isFinite(Number(value))
  ? new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(Number(value)) : "—";
const dateLabel = (value: string | null) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date) : "Data não informada";
};

function PriceHistoryChart({ analytics, range }: { analytics: PolymarketMarketAnalytics | null; range: number }) {
  const allPoints = (analytics?.history ?? []).filter((item) => Number.isFinite(Date.parse(item.timestamp)) && Number.isFinite(Number(item.price)) && Number(item.price) >= 0 && Number(item.price) <= 1).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const cutoff = allPoints.length ? Date.parse(allPoints[allPoints.length - 1].timestamp) - range * 60 * 60 * 1000 : 0;
  const points = allPoints.filter((item) => Date.parse(item.timestamp) >= cutoff);
  if (points.length < 2) return <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">Histórico insuficiente para o período selecionado.</div>;
  const start = Date.parse(points[0].timestamp);
  const end = Date.parse(points[points.length - 1].timestamp);
  const line = points.map((point, index) => `${end === start ? index / (points.length - 1) * 100 : (Date.parse(point.timestamp) - start) / (end - start) * 100},${100 - Number(point.price) * 100}`).join(" ");
  return <div className="space-y-2"><div className="relative h-56 sm:h-64"><div className="absolute inset-0 flex flex-col justify-between text-right text-xs text-muted-foreground">{[100, 75, 50, 25, 0].map((level) => <span key={level} className="border-t border-dashed border-border/60">{level}%</span>)}</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Histórico de preço: ${analytics?.outcomeLabel}`} className="absolute inset-0 h-full w-[calc(100%-38px)] overflow-visible"><polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></div><div className="flex justify-between pr-10 text-xs text-muted-foreground"><span>{new Date(start).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span><span>{new Date(end).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div></div>;
}

function OrderBook({ analytics }: { analytics: PolymarketMarketAnalytics | null }) {
  if (!analytics) return <p className="py-4 text-sm text-muted-foreground">Livro de ofertas indisponível.</p>;
  return <div className="grid gap-6 py-4 sm:grid-cols-2">{([['Compras', analytics.bids, 'text-emerald-400'], ['Vendas', analytics.asks, 'text-rose-400']] as const).map(([label, levels, color]) => <div key={label}><h3 className={`mb-3 text-sm font-semibold ${color}`}>{label}</h3><div className="flex justify-between border-b border-border pb-2 text-xs text-muted-foreground"><span>Preço</span><span>Quantidade</span></div>{levels.length ? levels.map((level, index) => <div key={`${level.price}-${index}`} className="flex justify-between py-1.5 text-sm"><span>{probability(level.price)}</span><span className="text-muted-foreground">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(level.size))}</span></div>) : <p className="py-3 text-sm text-muted-foreground">Nenhuma oferta disponível.</p>}</div>)}</div>;
}

export function PolymarketMarketDetailPage({ market, fx, analytics, insights, commentsResult }: { market: PolymarketMarket | null; fx: FxQuote | null; analytics: PolymarketMarketAnalytics | null; insights: MarketInsights | null; commentsResult: { comments: PolymarketPublicComment[]; error: boolean } }) {
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState(24);
  const { state: stream, quote } = usePolymarketMarketStream(analytics?.assetId ?? null);
  if (!market) return <section className="mx-auto max-w-3xl py-12"><h1 className="text-xl font-bold">Mercado não encontrado</h1><p className="mt-2 text-muted-foreground">O mercado pode ter sido removido ou estar indisponível na fonte.</p><Button className="mt-4" asChild><Link to="/polymarket">Voltar aos mercados</Link></Button></section>;

  const selected = market.outcomes.find((item) => item.label === params.get("outcome")) ?? market.outcomes[0];
  const selectOutcome = (label: string) => {
    const next = new URLSearchParams(params);
    next.set("outcome", label);
    setParams(next, { preventScrollReset: true });
  };
  const streamLabel = stream === "live" ? "Ao vivo" : stream === "idle" ? "Sem atualização ao vivo" : "Reconectando";

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 py-1">
      <Link to="/polymarket" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Polymarket</Link>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <header className="flex items-start gap-3">{market.imageUrl ? <img src={market.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary"><ChartNoAxesCombined className="h-6 w-6 text-primary" /></div>}<div className="min-w-0 flex-1"><p className="mb-1 text-sm text-muted-foreground">Polymarket {market.category ? `· ${market.category}` : "· Mercado"}</p><h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{market.question}</h1></div><PolymarketFavoriteButton marketId={market.id} /></header>

          <section aria-label="Histórico de preços" className="space-y-4"><div className="flex flex-wrap items-center gap-4 text-sm">{market.outcomes.map((outcome, index) => <button key={`${outcome.label}-${index}`} type="button" onClick={() => selectOutcome(outcome.label)} aria-pressed={selected?.label === outcome.label} className={`flex items-center gap-1.5 ${selected?.label === outcome.label ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}><span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-blue-400" : "bg-rose-400"}`} />{outcome.label} {probability(outcome.price)}</button>)}</div><PriceHistoryChart analytics={analytics?.outcomeLabel === selected?.label ? analytics : null} range={range} /><div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 text-xs text-muted-foreground"><div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4" /> {usd(market.volumeUsd)} Vol.</span><span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {dateLabel(market.endDate)}</span></div><div className="flex items-center gap-1" role="group" aria-label="Período do gráfico">{[{ label: "1H", hours: 1 }, { label: "6H", hours: 6 }, { label: "1D", hours: 24 }].map((item) => <button key={item.hours} type="button" onClick={() => setRange(item.hours)} aria-pressed={range === item.hours} className={`rounded-md px-2 py-1 font-semibold ${range === item.hours ? "bg-secondary text-foreground" : "hover:text-foreground"}`}>{item.label}</button>)}</div></div></section>

          <section aria-labelledby="outcomes-heading"><div className="mb-2 flex items-center justify-between"><h2 id="outcomes-heading" className="text-lg font-semibold">Resultados</h2><span className="text-xs text-muted-foreground">{streamLabel}</span></div><div className="divide-y divide-border border-y border-border">{market.outcomes.map((outcome, index) => <div key={`${outcome.label}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-4"><span className="min-w-0 flex-1 font-semibold">{outcome.label}</span><span className="text-xl font-bold">{probability(outcome.price)}</span><button type="button" onClick={() => selectOutcome(outcome.label)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${index === 0 ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"}`}>Selecionar {outcome.label}</button></div>)}</div>{quote && stream === "live" && <p className="mt-3 text-xs text-muted-foreground">{selected?.label} · Melhores ofertas ao vivo: compra {probability(quote.bestBid)} / venda {probability(quote.bestAsk)}{quote.lastTradePrice !== null ? ` · último negócio ${probability(quote.lastTradePrice)}` : ""}. O simulador usa uma amostra do livro de ofertas.</p>}</section>

          <details className="border-b border-border pb-4"><summary className="cursor-pointer text-lg font-semibold">Regras do mercado</summary><p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">{market.description || "Regras indisponíveis na fonte."}</p></details>
          <details className="border-b border-border pb-4"><summary className="cursor-pointer text-lg font-semibold">Livro de ofertas · {analytics?.outcomeLabel ?? selected?.label ?? "—"}</summary><OrderBook analytics={analytics} /></details>
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground"><div>Liquidez<p className="mt-1 font-semibold text-foreground">{usd(market.liquidityUsd)}</p></div><div>Interesse em aberto<p className="mt-1 font-semibold text-foreground">{usd(insights?.openInterest == null ? null : String(insights.openInterest))}</p></div><div>Resolução na fonte<p className="mt-1 font-semibold text-foreground">{insights?.resolution ?? "Não informada"}</p></div><div>Atualizado na fonte<p className="mt-1 font-semibold text-foreground">{dateLabel(market.sourceUpdatedAt)}</p></div></div>
          <details className="border-b border-border pb-4"><summary className="cursor-pointer text-lg font-semibold">Maiores posições na Polymarket</summary>{insights?.holders == null ? <p className="mt-3 text-sm text-muted-foreground">Dados indisponíveis.</p> : insights.holders.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma posição encontrada.</p> : <ul className="mt-3 space-y-2 text-sm">{insights.holders.map((holder, index) => <li key={`${holder.tokenId}-${index}`} className="flex justify-between gap-3"><span>{holder.name} <span className="text-muted-foreground">· {market.outcomes.find((item) => item.tokenId === holder.tokenId || item.positionId === holder.tokenId)?.label ?? "Resultado"}</span></span><span>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(holder.amount)} shares</span></li>)}</ul>}</details>
          {market.eventId && <PolymarketEventComments eventId={market.eventId} external={commentsResult.comments} externalError={commentsResult.error} />}
          {fx && <p className="text-xs text-muted-foreground">Cotação de referência PTAX: US$ 1 ≈ {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(fx.rate))}, em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${fx.referenceDate}T00:00:00Z`))}. Valores em BRL são estimativas.</p>}
          {market.url && <a href={market.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">Abrir na Polymarket <ExternalLink className="h-4 w-4" /></a>}
        </div>
        <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1"><PolymarketPaperTradeCard market={market} analytics={analytics} selectedOutcome={selected?.label ?? null} onSelectOutcome={selectOutcome} /></aside>
      </div>
    </section>
  );
}
