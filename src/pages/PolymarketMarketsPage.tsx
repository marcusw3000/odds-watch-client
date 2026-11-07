import { ArrowRight, Bookmark, ChartNoAxesCombined, FlaskConical, RefreshCw, Search, TrendingUp, X } from "lucide-react";
import { Form, Link, useNavigate, Await } from "react-router-dom";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PolymarketFavoriteButton } from "@/components/polymarket/PolymarketFavoriteButton";
import { PolymarketImage } from "@/components/polymarket/PolymarketImage";
import type { PolymarketMarket, PolymarketMarketAnalytics } from "@/types/polymarket";
import type { CatalogEvent, CatalogFilters, CatalogPage } from "@/services/PolymarketCatalogCache.server";
import type { FxQuote } from "@/types/fx";
import type { PolymarketTag } from "@/services/PolymarketTags.server";
import type { PolymarketEvent } from "@/services/PolymarketEventProvider.server";
import type { EventPriceSeries } from "@/services/PolymarketEventAnalytics.server";

const categories = [
  { label: "Em alta", value: "" }, { label: "Política", value: "politics" },
  { label: "Esportes", value: "sports" }, { label: "Cripto", value: "crypto" },
  { label: "Esports", value: "esports" }, { label: "Irã", value: "iran" }, { label: "Finanças", value: "finance" },
  { label: "Geopolítica", value: "geopolitics" }, { label: "Tecnologia", value: "tech" },
  { label: "Eleições", value: "elections" }, { label: "Cultura", value: "pop-culture" },
  { label: "Economia", value: "economy" }, { label: "Clima", value: "weather" }, { label: "Arte", value: "art" },
];

function formatUsd(value: string | null) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: Number(value) >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value));
}

function probability(value: string | null) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(Number(value));
}

function MarketImage({ market, className = "" }: { market: PolymarketMarket; className?: string }) {
  return market.imageUrl ? <PolymarketImage src={market.imageUrl} className={`h-10 w-10 shrink-0 rounded-lg object-cover ${className}`} /> : <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary ${className}`}><ChartNoAxesCombined className="h-5 w-5" /></div>;
}

function MarketCard({ market }: { market: PolymarketMarket }) {
  return (
    <article className="flex min-h-[190px] flex-col rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:border-muted-foreground/50">
      <Link to={market.eventId ? `/polymarket/event/${encodeURIComponent(market.eventId)}` : `/polymarket/market/${market.id}`} className="flex items-start gap-2.5">
        <MarketImage market={market} />
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{market.question}</h3>
      </Link>
      <div className="mt-4 space-y-2">
        {market.outcomes.slice(0, 2).map((outcome, index) => (
          <Link key={`${outcome.label}-${index}`} to={`/polymarket/market/${market.id}?outcome=${encodeURIComponent(outcome.label)}`} className="flex items-center justify-between gap-2 rounded-md text-sm hover:bg-secondary/60">
            <span className="truncate font-medium">{outcome.label}</span>
            <span className={`min-w-16 rounded-md px-2 py-1 text-center font-semibold ${index === 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>{probability(outcome.price)}</span>
          </Link>
        ))}
        {market.outcomes.length === 0 && <p className="text-sm text-muted-foreground">Resultados indisponíveis</p>}
      </div>
      <div className="mt-auto flex items-end justify-between pt-3 text-xs font-medium text-muted-foreground"><span>{formatUsd(market.volumeUsd)} Vol.</span><PolymarketFavoriteButton marketId={market.id} className="h-7 w-7" /></div>
    </article>
  );
}

function EventCard({ event }: { event: CatalogEvent }) {
  const primaryMarket = event.markets[0];
  const rows = event.markets.length === 1
    ? primaryMarket.outcomes.slice(0, 2).map((outcome) => ({ label: outcome.label, price: outcome.price, marketId: primaryMarket.id, outcome: outcome.label }))
    : event.markets.map((market) => ({ label: market.question, price: market.outcomes.find((outcome) => outcome.label.toLowerCase() === "yes")?.price ?? market.outcomes[0]?.price ?? null, marketId: market.id, outcome: market.outcomes.find((outcome) => outcome.label.toLowerCase() === "yes")?.label ?? market.outcomes[0]?.label ?? "" }));
  return <article className="flex min-h-[190px] flex-col rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:border-muted-foreground/50">
    <Link to={`/polymarket/event/${encodeURIComponent(event.id)}`} className="flex items-start gap-2.5">
      {event.imageUrl ? <PolymarketImage src={event.imageUrl} className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><ChartNoAxesCombined className="h-5 w-5" /></div>}
      <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{event.title}</h3>
    </Link>
    <div className="mt-4 space-y-2">{rows.map((row, index) => <Link key={`${row.marketId}-${row.outcome}-${index}`} to={`/polymarket/market/${encodeURIComponent(row.marketId)}?outcome=${encodeURIComponent(row.outcome)}`} className="flex items-center justify-between gap-2 rounded-md text-sm hover:bg-secondary/60"><span className="truncate font-medium">{row.label}</span><span className={`min-w-16 rounded-md px-2 py-1 text-center font-semibold ${index === 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>{probability(row.price)}</span></Link>)}{rows.length === 0 && <p className="text-sm text-muted-foreground">Resultados aguardando sincronização</p>}</div>
    <div className="mt-auto flex items-end justify-between pt-3 text-xs font-medium text-muted-foreground"><span>{formatUsd(event.volumeUsd)} Vol.</span><Link to={`/polymarket/event/${encodeURIComponent(event.id)}`} className="text-primary hover:underline">Ver evento</Link></div>
  </article>;
}

function FeaturedMarket({ market, analytics }: { market: PolymarketMarket; analytics: PolymarketMarketAnalytics | null }) {
  const points = (analytics?.history ?? []).filter((point) => Number.isFinite(Number(point.price)) && Number(point.price) >= 0 && Number(point.price) <= 1);
  const chart = points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * 100},${100 - Number(point.price) * 100}`).join(" ");
  return (
    <section aria-labelledby="featured-market" className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><Link to={`/polymarket/market/${market.id}`} className="flex min-w-0 items-center gap-3"><MarketImage market={market} className="h-12 w-12" /><div><p className="text-xs font-medium text-muted-foreground">Mercado em destaque</p><h2 id="featured-market" className="line-clamp-2 text-lg font-bold sm:text-xl">{market.question}</h2></div></Link><PolymarketFavoriteButton marketId={market.id} /></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">{market.outcomes.slice(0, 4).map((outcome, index) => <Link key={`${outcome.label}-${index}`} to={`/polymarket/market/${market.id}?outcome=${encodeURIComponent(outcome.label)}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-1 text-sm hover:bg-secondary"><span className="truncate font-medium">{outcome.label}</span><strong className="text-lg">{probability(outcome.price)}</strong></Link>)}<p className="pt-2 text-xs text-muted-foreground">{formatUsd(market.volumeUsd)} negociados</p></div>
        <div><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-blue-500" />{analytics?.outcomeLabel ?? "Histórico de preço"}<span>· últimas 24 horas</span></div>{points.length >= 2 ? <div className="relative h-36 border-b border-border/70 sm:h-44"><div className="absolute inset-0 flex flex-col justify-between text-right text-[10px] text-muted-foreground"><span className="border-t border-dashed border-border/50">100%</span><span className="border-t border-dashed border-border/50">50%</span><span className="border-t border-dashed border-border/50">0%</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Histórico de preço de ${analytics?.outcomeLabel}`} className="absolute inset-0 h-full w-[calc(100%-30px)] overflow-visible"><polyline points={chart} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg></div> : <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground sm:h-44">Histórico indisponível para este mercado.</div>}</div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Dados públicos Polymarket</span><Link to={`/polymarket/market/${market.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">Ver mercado <ArrowRight className="h-3 w-3" /></Link></div>
    </section>
  );
}

function FeaturedEvent({ event, series }: { event: PolymarketEvent; series: EventPriceSeries[] }) {
  const colors = ["#60a5fa", "#f87171", "#facc15", "#34d399"];
  const points = series.flatMap((item) => item.points);
  const start = Math.min(...points.map((point) => point.time));
  const end = Math.max(...points.map((point) => point.time));
  const minimum = Math.min(...points.map((point) => point.price));
  const maximum = Math.max(...points.map((point) => point.price));
  const padding = Math.max((maximum - minimum) * 0.15, 0.01);
  const lower = Math.max(0, minimum - padding);
  const upper = Math.min(1, maximum + padding);
  const rows = event.markets.length === 1
    ? event.markets[0].outcomes.slice(0, 4).map((outcome) => ({ label: outcome.label, price: outcome.price }))
    : [...event.markets].sort((a, b) => Number(b.outcomes[0]?.price ?? 0) - Number(a.outcomes[0]?.price ?? 0)).slice(0, 4).map((market) => ({ label: market.question, price: market.outcomes[0]?.price ?? null }));
  const eventLink = `/polymarket/event/${encodeURIComponent(event.id)}`;
  return <section aria-labelledby="featured-event" className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
    <Link to={eventLink} className="flex items-center gap-3">{event.imageUrl && <PolymarketImage src={event.imageUrl} eager className="h-12 w-12 rounded-lg object-cover" />}<div><p className="text-xs text-muted-foreground">Evento em destaque</p><h2 id="featured-event" className="text-lg font-bold sm:text-xl">{event.title}</h2></div></Link>
    <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)]"><div className="space-y-3">{rows.map((row, index) => <Link key={`${row.label}-${index}`} to={eventLink} className="flex justify-between gap-3 text-sm"><span className="line-clamp-2 font-medium">{row.label}</span><strong className="shrink-0 text-lg">{probability(row.price)}</strong></Link>)}<p className="pt-2 text-xs text-muted-foreground">{formatUsd(event.volumeUsd)} negociados</p></div>
    <div><div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{series.map((item, index) => <span key={item.marketId} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index] }} />{item.label}</span>)}</div><div className="relative h-36 sm:h-44"><div className="absolute inset-0 flex flex-col justify-between text-right text-[10px] text-muted-foreground">{[upper, (upper + lower) / 2, lower].map((value, index) => <span key={index} className="border-t border-dashed border-border/50">{(value * 100).toFixed(value < 0.1 ? 1 : 0)}%</span>)}</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Histórico de probabilidades do evento nos últimos 30 dias" className="absolute inset-0 h-full w-[calc(100%-38px)] overflow-visible">{series.map((item, index) => <polyline key={item.marketId} points={item.points.map((point) => `${(point.time - start) / Math.max(end - start, 1) * 100},${100 - (point.price - lower) / Math.max(upper - lower, 0.0001) * 100}`).join(" ")} fill="none" stroke={colors[index]} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}</svg></div><div className="mt-2 flex justify-between pr-10 text-xs text-muted-foreground"><span>{new Date(start * 1000).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span><span>{new Date(end * 1000).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span></div></div></div>
    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Histórico público Polymarket · até 30 dias</span><Link to={eventLink} className="inline-flex items-center gap-1 text-primary hover:underline">Ver evento <ArrowRight className="h-4 w-4" /></Link></div>
  </section>;
}

function catalogUrl(filters: CatalogFilters, changes: Partial<CatalogFilters>) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.category) params.set("category", next.category);
  if (next.status !== "open") params.set("status", next.status);
  if (next.sort !== "volume") params.set("sort", next.sort);
  if (next.minVolume) params.set("minVolume", next.minVolume);
  if (next.endAfter) params.set("endAfter", next.endAfter);
  if (next.endBefore) params.set("endBefore", next.endBefore);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/polymarket?${query}` : "/polymarket";
}

export function PolymarketMarketsPage({ data, fx, filters, tags, featured, error }: { data: CatalogPage; fx: Promise<FxQuote | null>; filters: CatalogFilters; tags: Promise<PolymarketTag[]>; featured: Promise<{ analytics: PolymarketMarketAnalytics | null; featuredEvent: PolymarketEvent | null; featuredSeries: EventPriceSeries[] }>; error: boolean }) {
  const navigate = useNavigate();
  const showFeatured = !data.searchQuery && data.page === 1 && data.markets.length > 0;
  return (
    <section className="mx-auto w-full max-w-[1440px] space-y-6 py-1">
      <nav aria-label="Categorias Polymarket" className="flex gap-1 overflow-x-auto border-b border-border pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((item) => <Link key={item.value} to={catalogUrl(filters, { category: item.value, page: 1 })} aria-current={filters.category === item.value ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${filters.category === item.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}>{item.label}</Link>)}
      </nav>
      <Suspense fallback={null}><Await resolve={tags}>{(items) => items.length > 0 && <nav aria-label="Tópicos da Polymarket" className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{items.map((tag) => <Link key={tag.value} to={catalogUrl(filters, { category: tag.value, page: 1 })} aria-current={filters.category === tag.value ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${filters.category === tag.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}>{tag.label}</Link>)}</nav>}</Await></Suspense>

      {showFeatured && <Suspense fallback={<div role="status" className="min-h-[240px] rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Carregando destaque...</div>}><Await resolve={featured} errorElement={<FeaturedMarket market={data.markets[0]} analytics={null} />}>{({ featuredEvent, featuredSeries, analytics }) => featuredEvent && featuredSeries.length ? <FeaturedEvent event={featuredEvent} series={featuredSeries} /> : <FeaturedMarket market={data.markets[0]} analytics={analytics} />}</Await></Suspense>}

      <section aria-labelledby="all-markets" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 id="all-markets" className="text-xl font-bold tracking-tight">{data.searchQuery ? "Resultados da pesquisa" : filters.category ? categories.find((item) => item.value === filters.category)?.label ?? filters.category : "Todos os eventos"}</h1><p className="mt-1 text-xs text-muted-foreground">{data.events ? `${(data.totalMatches ?? data.events.length).toLocaleString("pt-BR")} eventos encontrados na cache` : `${data.markets.length} mercados nesta amostra`}</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" asChild><Link to="/polymarket/favorites" aria-label="Meus favoritos"><Bookmark className="h-4 w-4" /></Link></Button><Button variant="outline" size="sm" asChild><Link to="/polymarket/paper"><FlaskConical className="h-4 w-4" /> Paper Trading</Link></Button><Button variant="ghost" size="icon" onClick={() => navigate(0)} aria-label="Atualizar mercados"><RefreshCw className="h-4 w-4" /></Button></div></div>
        <Form key={JSON.stringify(filters)} method="get" className="space-y-3">
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="q" aria-label="Pesquisar mercados Polymarket" type="search" maxLength={80} defaultValue={filters.query} placeholder="Pesquisar mercados" className="pl-9" /></div><Button type="submit">Pesquisar</Button><Button variant="outline" size="icon" asChild><Link to="/polymarket" aria-label="Limpar filtros"><X className="h-4 w-4" /></Link></Button></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <label className="space-y-1 text-xs text-muted-foreground">Status<select name="status" defaultValue={filters.status} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="open">Abertos</option><option value="closed">Encerrados</option><option value="all">Todos</option></select></label>
            <label className="space-y-1 text-xs text-muted-foreground">Ordenar por<select name="sort" defaultValue={filters.sort} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="volume">Volume total</option><option value="end_date">Encerramento</option><option value="updated">Atualização</option></select></label>
            <label className="space-y-1 text-xs text-muted-foreground">Volume mínimo (USD)<Input name="minVolume" type="number" min="0" max="1000000000000" step="any" defaultValue={filters.minVolume} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Encerra a partir de<Input name="endAfter" type="date" defaultValue={filters.endAfter} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Encerra até<Input name="endBefore" type="date" defaultValue={filters.endBefore} /></label>
          </div>
        </Form>
        {data.cacheError ? <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Catálogo persistente indisponível; mostrando uma amostra da fonte. Os filtros e a paginação completa exigem a sincronização da cache.</p> : <p role="status" className="rounded-md border border-border bg-card/50 p-3 text-xs text-muted-foreground">{data.cacheComplete === true ? "Um ciclo de sincronização foi concluído. Resultados e totais refletem a cache, que pode estar desatualizada." : "A cobertura da cache ainda não foi confirmada como completa. Resultados e totais refletem apenas os eventos sincronizados."}{data.lastSyncAt && !Number.isNaN(Date.parse(data.lastSyncAt)) ? ` Último lote: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(data.lastSyncAt))} UTC.` : ""}</p>}
        {error ? <div role="alert" className="rounded-xl border border-destructive/50 p-6 text-destructive">Não foi possível consultar o catálogo com estes filtros. Tente novamente.</div> : data.events?.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.events.map((event) => <EventCard key={event.id} event={event} />)}</div> : data.markets.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.markets.map((market) => <MarketCard key={market.id} market={market} />)}</div> : <div className="rounded-xl border border-dashed p-10 text-center"><TrendingUp className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-semibold">Nenhum evento encontrado na cache</p><p className="mt-1 text-sm text-muted-foreground">Tente outros filtros ou aguarde a sincronização.</p></div>}
        {!data.cacheError && !error && (data.page > 1 || data.hasNext) && <div className="flex items-center justify-center gap-3"><Button variant="outline" disabled={data.page <= 1} asChild={data.page > 1}>{data.page > 1 ? <Link to={catalogUrl(filters, { page: data.page - 1 })}>Anterior</Link> : <span>Anterior</span>}</Button><span className="text-sm text-muted-foreground">Página {data.page}</span>{data.hasNext && <Button variant="outline" asChild><Link to={catalogUrl(filters, { page: data.page + 1 })}>Próxima <ArrowRight className="h-4 w-4" /></Link></Button>}</div>}
        <p className="text-xs text-muted-foreground">Dados públicos da Polymarket. Valores em USD; operações nesta plataforma são simuladas.<Suspense fallback={null}><Await resolve={fx}>{(quote) => quote ? ` Câmbio de referência: US$ 1 ≈ ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(quote.rate))} (PTAX de ${quote.referenceDate}).` : ""}</Await></Suspense></p>
      </section>
    </section>
  );
}
