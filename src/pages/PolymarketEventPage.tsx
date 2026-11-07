import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import { Link, useSearchParams, Await } from "react-router-dom";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { PolymarketFavoriteButton } from "@/components/polymarket/PolymarketFavoriteButton";
import { PolymarketEventComments } from "@/components/polymarket/PolymarketEventComments";
import { PolymarketSportsScore } from "@/components/polymarket/PolymarketSportsScore";
import { PolymarketImage } from "@/components/polymarket/PolymarketImage";
import type { PolymarketEvent } from "@/services/PolymarketEventProvider.server";
import type { PolymarketPublicComment } from "@/services/PolymarketPublicComments.server";
import type { EventChartInterval, EventPriceSeries } from "@/services/PolymarketEventAnalytics.server";

const probability = (value: string | null) => value !== null && Number.isFinite(Number(value)) ? new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(Number(value)) : "—";
const usd = (value: string | null) => value !== null && Number.isFinite(Number(value)) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: Number(value) >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value)) : "—";

function EventChart({ series, period }: { series: EventPriceSeries[]; period: EventChartInterval }) {
  const [params, setParams] = useSearchParams();
  const colors = ["#60a5fa", "#f87171", "#facc15", "#34d399"];
  const all = series.flatMap((item) => item.points);
  const start = all.length ? Math.min(...all.map((point) => point.time)) : 0;
  const end = all.length ? Math.max(...all.map((point) => point.time)) : 0;
  const min = all.length ? Math.min(...all.map((point) => point.price)) * 100 : 0;
  const max = all.length ? Math.max(...all.map((point) => point.price)) * 100 : 100;
  const rawStep = Math.max((max - min) / 5, 0.1);
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const step = (rawStep < 5 ? Math.ceil(rawStep / power) : ([1, 2, 5, 10].find((factor) => factor * power >= rawStep) ?? 10)) * power;
  const lower = Math.max(0, step >= 5 ? Math.floor(min / step) * step : Math.floor(min / power) * power);
  const upper = Math.min(100, Math.max(lower + step, Math.ceil(max / power) * power));
  const ticks: number[] = [];
  for (let tick = lower; tick <= upper + step / 100; tick += step) ticks.push(Math.min(tick, upper));
  const displayDate = (value: number) => new Intl.DateTimeFormat("pt-BR", period === "1h" || period === "1d" ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC" } : { day: "2-digit", month: "short", ...(period === "max" ? { year: "2-digit" as const } : {}), timeZone: "UTC" }).format(new Date(value * 1000));
  return <section className="space-y-3" aria-label="Histórico comparativo"><h2 className="text-lg font-semibold">Histórico comparativo</h2><div className="flex flex-wrap gap-3">{series.map((item, index) => <span key={item.marketId} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index] }} />{item.label}</span>)}</div>{all.length ? <><div className="relative h-56"><div className="absolute inset-0 text-right text-xs text-muted-foreground">{ticks.map((n, index) => <span key={index} style={{ top: `${100 - (n - lower) / Math.max(upper - lower, 0.0001) * 100}%` }} className="absolute left-0 right-0 border-t border-dashed border-border/60">{Number(n.toFixed(2))}%</span>)}</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Histórico comparativo de probabilidades · ${period.toUpperCase()}`} className="absolute inset-0 h-full w-[calc(100%-45px)] overflow-visible">{series.map((item, index) => <polyline key={item.marketId} points={item.points.map((point) => `${(point.time - start) / Math.max(end - start, 1) * 100},${100 - (point.price * 100 - lower) / Math.max(upper - lower, 0.0001) * 100}`).join(" ")} fill="none" stroke={colors[index]} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}</svg></div><div className="flex justify-between pr-12 text-xs text-muted-foreground"><span>{displayDate(start)}</span><span>{displayDate(end)} UTC</span></div></> : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Histórico comparativo indisponível para este período.</p>}<div role="group" aria-label="Período do gráfico" className="flex flex-wrap gap-1">{(["1h", "1d", "1w", "1m", "max"] as const).map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => { const next = new URLSearchParams(params); if (value === "max") next.delete("period"); else next.set("period", value); setParams(next, { preventScrollReset: true }); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${period === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{value.toUpperCase()}</button>)}</div></section>;
}

export function PolymarketEventPage({ event, failed, comments, series, liveVolume, period }: { event: PolymarketEvent | null; failed: boolean; comments: Promise<{ items: PolymarketPublicComment[]; error: boolean }>; series: Promise<EventPriceSeries[]>; liveVolume: Promise<number | null>; period: EventChartInterval }) {
  const [visibleCount, setVisibleCount] = useState(20);
  if (!event) return <section className="mx-auto max-w-3xl space-y-4 py-12"><h1 className="text-xl font-bold">{failed ? "Evento temporariamente indisponível" : "Evento não encontrado"}</h1><p className="text-muted-foreground">{failed ? "Não foi possível consultar a Polymarket nem a cópia disponível." : "O evento pode ter sido removido ou não existir."}</p><Button asChild><Link to="/polymarket">Voltar aos mercados</Link></Button></section>;
  return <section className="mx-auto w-full max-w-5xl space-y-6 py-1">
    <Link to="/polymarket" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Polymarket</Link>
    <header className="flex items-start gap-3">{event.imageUrl && <PolymarketImage src={event.imageUrl} eager className="h-16 w-16 shrink-0 rounded-xl object-cover" />}<div><p className="mb-1 text-sm text-muted-foreground">Polymarket · Evento</p><h1 className="text-2xl font-bold leading-tight tracking-tight">{event.title}</h1><p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground"><Trophy className="h-4 w-4" /> {usd(event.volumeUsd)} Vol.</p></div></header>
    {event.stale && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Exibindo dados salvos; mercados e preços podem estar desatualizados.</p>}
    {event.tags.some((tag) => tag === "sports" || tag === "esports") && <PolymarketSportsScore slug={event.slug} />}
    <Suspense fallback={<p role="status" className="min-h-[320px] py-8 text-sm text-muted-foreground">Carregando histórico...</p>}><Await resolve={series} errorElement={<EventChart series={[]} period={period} />}>{(items) => <EventChart series={items} period={period} />}</Await></Suspense>
    <Suspense fallback={null}><Await resolve={liveVolume}>{(value) => value !== null && <p className="text-xs text-muted-foreground">Volume taker do evento: {usd(String(value))}</p>}</Await></Suspense>
    <section aria-labelledby="event-markets"><h2 id="event-markets" className="mb-3 text-lg font-semibold">Mercados deste evento</h2><p className="mb-4 text-sm text-muted-foreground">Selecione um resultado para ver o mercado e simular uma operação.</p>{event.markets.length ? <div className="divide-y divide-border border-y border-border">{event.markets.slice(0, visibleCount).map((market) => <article key={market.id} className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-0 flex-1 basis-48"><Link to={`/polymarket/market/${market.id}`} className="font-semibold hover:text-primary">{market.question}</Link><p className="mt-1 text-xs text-muted-foreground">{usd(market.volumeUsd)} Vol. {market.status === "closed" ? "· Encerrado" : ""}</p></div><div className="flex flex-wrap items-center gap-2">{market.outcomes.map((outcome, index) => <Link key={`${outcome.label}-${index}`} to={`/polymarket/market/${market.id}?outcome=${encodeURIComponent(outcome.label)}`} className={`rounded-lg px-3 py-2 text-sm font-semibold ${index === 0 ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"}`}>{outcome.label} {probability(outcome.price)}</Link>)}<PolymarketFavoriteButton marketId={market.id} className="h-8 w-8" /></div></article>)}</div> : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nenhum mercado disponível neste evento.</p>}{visibleCount < event.markets.length && <Button variant="outline" className="mt-4" onClick={() => setVisibleCount((count) => count + 20)}>Mostrar mais mercados</Button>}</section>
    {event.description && <details className="border-b border-border pb-4"><summary className="cursor-pointer text-lg font-semibold">Sobre o evento</summary><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{event.description}</p></details>}
    <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Carregando comentários...</p>}><Await resolve={comments}>{(result) => <PolymarketEventComments eventId={event.id} external={result.items} externalError={result.error} />}</Await></Suspense>
    {event.slug && <a href={`https://polymarket.com/event/${encodeURIComponent(event.slug)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">Abrir na Polymarket <ExternalLink className="h-4 w-4" /></a>}
    <p className="text-xs text-muted-foreground">Dados públicos. As operações nesta plataforma são simuladas e não enviam ordens à Polymarket.</p>
  </section>;
}
