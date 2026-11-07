import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { quotePaperBook, resolvePaperMarket } from "../_shared/paperQuote.ts";
import { inferSalePositions, sizePaperCopy } from "../_shared/paperCopy.ts";

type Strategy = { id: string; user_id: string; source_kind: "paper" | "polymarket"; source_id: string; started_at: string; monitored_at: string; active: boolean; total_limit: number; spent_usd: number; per_trade_limit: number; max_price_deviation: number; round_id: string };
type Event = { key: string; market: string; question: string; outcome: string; price: number; notional: number; at: string; side: "BUY" | "SELL"; shares?: number; before?: number; unavailable?: string };
const requestJson = async (url: string) => {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Fonte pública indisponível (${response.status})`);
  return response.json();
};

export async function handlePaperCopyRequest(req: Request) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("PAPER_COPY_CRON_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  if (!service || !secret || !url || req.headers.get("x-copy-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const started = Date.now();
  const cutoff = new Date(started).toISOString();
  const { data: strategies, error } = await db.from("paper_copy_strategies").select("*").eq("active", true).order("checked_at", { ascending: true }).limit(5);
  if (error) return new Response("Monitor unavailable", { status: 503 });
  let failures = 0;
  const expired = await db.from("paper_copy_signals").update({ status: "skipped", reason: "Solicitação expirada após uma hora" }).in("status", ["pending", "approved"]).lt("created_at", new Date(Date.now()-3_600_000).toISOString());
  if (expired.error) failures++;
  for (const s of (strategies ?? []) as Strategy[]) {
    if (Date.now() - started > 20_000) break;
    try {
      const from = new Date(Math.max(Date.parse(s.started_at), Date.parse(s.monitored_at) - 300_000));
      const seenRows = await db.from("paper_copy_signals").select("source_key").eq("strategy_id", s.id).gte("source_at", from.toISOString()).limit(1000);
      if (seenRows.error) throw seenRows.error;
      const seen = new Set((seenRows.data ?? []).map(row => row.source_key));
      let events: Event[] = [], incomplete = false;
      if (s.source_kind === "paper") {
        const profile = await db.from("profiles").select("is_public,show_trades").eq("id", s.source_id).maybeSingle();
        if (profile.error) throw profile.error;
        if (!profile.data?.is_public || !profile.data?.show_trades) {
          const paused = await db.from("paper_copy_strategies").update({ active: false, monitoring_error: "O trader ocultou o perfil ou o histórico; a estratégia foi pausada." }).eq("id", s.id).eq("started_at", s.started_at);
          if (paused.error) throw paused.error;
          const cancelled = await db.from("paper_copy_signals").update({ status: "skipped", reason: "Trader não está mais disponível para cópia" }).eq("strategy_id", s.id).in("status", ["pending", "approved"]);
          if (cancelled.error) throw cancelled.error;
          continue;
        } else {
          const trades = await db.from("polymarket_paper_trades").select("id,market_id,outcome_label,side,shares,position_before,price,notional_usd,created_at").eq("user_id", s.source_id).is("copy_signal_id", null).gte("created_at", from.toISOString()).lte("created_at", cutoff).order("created_at", { ascending: true }).limit(1000);
          if (trades.error || (trades.data?.length ?? 0) >= 1000) throw new Error("Atividades simuladas indisponíveis ou lote incompleto");
          events = (trades.data ?? []).filter(t => t.side === "BUY" || t.side === "SELL").map(t => ({ key: `paper:${t.id}`, market: t.market_id, question: "", outcome: t.outcome_label, price: Number(t.price), notional: Number(t.notional_usd), at: t.created_at, side: t.side as "BUY" | "SELL", shares: Number(t.shares), before: t.position_before == null ? undefined : Number(t.position_before), unavailable: t.side === "SELL" && t.position_before == null ? "Posição anterior à venda não está disponível" : undefined }));
        }
      } else {
        if (Math.floor(from.getTime()/1000) > Math.floor(Date.parse(cutoff)/1000)-2) continue;
        const raw: Record<string, unknown>[] = []; let cursor = "";
        for (let page = 0; page < 10; page++) {
          const query = new URLSearchParams({ user: s.source_id, type: "TRADE,SPLIT,MERGE,REDEEM,CONVERSION,MIGRATION,DIRECTIONAL_SPLIT,DIRECTIONAL_MERGE,THRESHOLD_COMPOSE,THRESHOLD_DECOMPOSE", limit: "100", start: String(Math.floor(from.getTime()/1000)), end: String(Math.floor(Date.parse(cutoff)/1000)-2) });
          if (cursor) query.set("cursor", cursor);
          const payload = await requestJson(`https://data-api.polymarket.com/v2/activity?${query}`);
          if (!Array.isArray(payload?.data) || !payload.pagination) throw new Error("Atividade pública inválida");
          raw.push(...payload.data);
          cursor = payload.pagination.next_cursor ?? "";
          if (!cursor) break;
          if (page === 9) throw new Error("Lote de atividade incompleto");
        }
        const grouped = new Map<string, { row: Record<string, unknown>; shares: number; value: number }>();
        for (const row of raw) {
          if ((row.side !== "BUY" && row.side !== "SELL") || row.type !== "TRADE" || row.is_combo === true || typeof row.transaction_hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(row.transaction_hash) || typeof row.token_id !== "string" || !/^\d{1,100}$/.test(row.token_id) || typeof row.slug !== "string" || typeof row.outcome !== "string" || Number(row.outcome_index) === 999 || !Number.isFinite(Number(row.timestamp)) || Number(row.size) <= 0 || Number(row.usdc_size) <= 0) continue;
          const key = `${row.transaction_hash.toLowerCase()}:${row.token_id}${row.side === "SELL" ? ":sell" : ""}`;
          const item = grouped.get(key) ?? { row, shares: 0, value: 0 };
          item.shares += Number(row.size); item.value += Number(row.usdc_size); grouped.set(key, item);
        }
        const groupedRows=[...grouped.entries()].sort((a,b)=>Number(a[1].row.timestamp)-Number(b[1].row.timestamp));
        const reconstructed = new Map<string, Map<string,number>>();
        for (const [key, item] of groupedRows) {
          if (seen.has(`poly:${key}`)) continue;
          if (events.length >= 10 || Date.now()-started > 15_000) { incomplete = true; break; }
          const gamma = await requestJson(`https://gamma-api.polymarket.com/markets?${new URLSearchParams({ slug: String(item.row.slug), limit: "1" })}`);
          if (!Array.isArray(gamma) || gamma.length !== 1 || !/^\d{1,20}$/.test(String(gamma[0]?.id))) throw new Error("Mercado de origem indisponível");
          if (gamma[0]?.closed === true || gamma[0]?.acceptingOrders !== true) continue;
          const market = String(gamma[0].id), outcome = String(item.row.outcome);
          const confirmed = resolvePaperMarket({ markets: gamma }, market, outcome);
          if (confirmed.token !== item.row.token_id) throw new Error("Token de origem incompatível");
          const side=item.row.side as "BUY" | "SELL", token=String(item.row.token_id);
          let before: number | undefined, unavailable: string | undefined;
          if(side === "SELL") {
            const condition=String(item.row.condition_id ?? "");
            if(!/^0x[0-9a-f]{64}$/i.test(condition)) unavailable="Condição da posição de origem indisponível";
            else if(raw.some(r=>r.type!=="TRADE" && (!r.condition_id && !r.event_slug || r.condition_id===condition || (r.event_slug && r.event_slug===item.row.event_slug)) && Number(r.timestamp)>=Number(item.row.timestamp))) unavailable="Movimentos de posição não negociados impedem calcular a proporção com segurança";
            else {
              if(!reconstructed.has(token)) {
                let position: Record<string,unknown> | undefined;
                for(const status of ["OPEN","CLOSED"]) {
                  const query=new URLSearchParams({user:s.source_id,condition,status,filter_amount:"0",limit:"100"});
                  const payload=await requestJson(`https://data-api.polymarket.com/v2/positions?${query}`);
                  if(!Array.isArray(payload?.data) || payload.pagination?.next_cursor)throw new Error("Posições de origem indisponíveis");
                  position=payload.data.find((p:Record<string,unknown>)=>String(p.token_id)===token);
                  if(position)break;
                }
                if(!position || position.current_size == null || position.last_event_at == null)throw new Error("Posição de origem indisponível");
                const movements=groupedRows.filter(([,g])=>String(g.row.token_id)===token).map(([k,g])=>({key:k,side:g.row.side as "BUY" | "SELL",shares:g.shares,time:Number(g.row.timestamp)}));
                try { reconstructed.set(token,inferSalePositions(movements,Number(position.current_size),Number(position.last_event_at),Math.floor(Date.parse(cutoff)/1000)-2)); }
                catch(error) { if(error instanceof Error && /ambígua/.test(error.message)) unavailable=error.message; else throw error; }
              }
              if(!unavailable)before=reconstructed.get(token)?.get(key);
              if(!before && !unavailable)unavailable="Não foi possível determinar a proporção da venda";
            }
          }
          events.push({ key: `poly:${key}`, market, question: confirmed.question, outcome, price: item.value/item.shares, notional: item.value, at: new Date(Number(item.row.timestamp)*1000).toISOString(), side, shares:item.shares, before, unavailable });
        }
      }
      let recorded = 0;
      for (const event of events) {
        if (seen.has(event.key)) continue;
        if (Date.parse(event.at) < Date.parse(s.started_at)) continue;
        if (recorded >= 10 || Date.now()-started > 35_000) { incomplete = true; break; }
        if (!event.question) {
          const gamma = await requestJson(`https://gamma-api.polymarket.com/markets/keyset?${new URLSearchParams({ id: event.market, closed: "any", limit: "1" })}`);
          const sourceMarket = Array.isArray(gamma?.markets) ? gamma.markets.find((row: Record<string, unknown>) => String(row?.id) === event.market) : null;
          if (sourceMarket?.closed === true || sourceMarket?.acceptingOrders !== true) continue;
          event.question = resolvePaperMarket(gamma, event.market, event.outcome).question;
        }
        const common = { p_strategy: s.id, p_key: event.key, p_market: event.market, p_question: event.question, p_outcome: event.outcome, p_price: event.price, p_notional: event.notional, p_at: event.at };
        const inserted = event.side === "BUY" ? await db.rpc("create_paper_copy_signal",common) : event.unavailable || !event.before || !event.shares ? await db.rpc("record_paper_copy_unavailable_sale",{...common,p_reason:event.unavailable ?? "Posição de origem indisponível"}) : await db.rpc("create_paper_copy_sale_signal",{...common,p_shares:event.shares,p_before:event.before});
        if (inserted.error) throw inserted.error;
        recorded++;
      }
      if (incomplete) throw new Error("Lote de monitoramento será retomado");
      const advanced = await db.from("paper_copy_strategies").update({ monitored_at: cutoff, last_success_at: cutoff, monitoring_error: null }).eq("id", s.id).eq("started_at", s.started_at).eq("monitored_at", s.monitored_at);
      if (advanced.error) throw advanced.error;
    } catch (err) {
      const batching = err instanceof Error && err.message === "Lote de monitoramento será retomado";
      if (!batching) { failures++; console.error("[paper-copy] monitoring failed", s.id, err); }
      const health = await db.from("paper_copy_strategies").update({ monitoring_error: batching ? "Processando operações em lotes; pode haver atraso." : "Não foi possível atualizar este trader. O sistema tentará novamente." }).eq("id", s.id).eq("started_at", s.started_at);
      if (health.error) failures++;
    }
    finally { const checked = await db.from("paper_copy_strategies").update({ checked_at: new Date().toISOString() }).eq("id", s.id); if (checked.error) failures++; }
  }
  const pending = await db.from("paper_copy_signals").select("*,paper_copy_strategies!inner(*)").eq("status", "approved").order("created_at", { ascending: true }).limit(10);
  if (pending.error) return new Response("Queue unavailable", { status: 503 });
  for (const signal of pending.data ?? []) {
    if (Date.now() - started > 40_000) break;
    try {
      const s = signal.paper_copy_strategies as Strategy;
      const wallet = await db.from("polymarket_paper_wallets").select("balance_usd,round_id").eq("user_id", s.user_id).single();
      if (wallet.error) throw wallet.error;
      if (!s.active || wallet.data.round_id !== s.round_id || Date.now()-Date.parse(signal.created_at)>3_600_000) throw new Error("Estratégia pausada, carteira reiniciada ou sinal expirado");
      let shares: number, limitPrice: number;
      const side = signal.side === "SELL" ? "SELL" : "BUY";
      if(side === "SELL") {
        const position=await db.from("paper_copy_positions").select("shares").eq("strategy_id",s.id).eq("round_id",s.round_id).eq("market_id",signal.market_id).eq("outcome",signal.outcome).maybeSingle();
        if(position.error)throw position.error;
        shares=Math.floor(Number(position.data?.shares ?? 0)*Number(signal.sell_fraction)*1_000_000)/1_000_000;
        limitPrice=Math.max(0.000001,Number(signal.source_price)-Number(s.max_price_deviation));
        if(!Number.isFinite(shares)||shares<=0)throw new Error("Nenhuma share copiada disponível para venda");
      } else {
        const quote = sizePaperCopy({ sourceNotional: Number(signal.source_notional), totalLimit: Number(s.total_limit), spent: Number(s.spent_usd), perTradeLimit: Number(s.per_trade_limit), balance: Number(wallet.data.balance_usd), sourcePrice: Number(signal.source_price), maxPriceDeviation: Number(s.max_price_deviation) });
        shares=quote.shares;limitPrice=quote.limitPrice;
      }
      const gamma = await requestJson(`https://gamma-api.polymarket.com/markets/keyset?${new URLSearchParams({ id: signal.market_id, closed: "any", limit: "1" })}`);
      const market = resolvePaperMarket(gamma, signal.market_id, signal.outcome);
      const book = await requestJson(`https://clob.polymarket.com/book?${new URLSearchParams({ token_id: market.token })}`);
      const price = quotePaperBook(book, market.token, shares, side);
      if ((side === "BUY" && price > limitPrice) || (side === "SELL" && price < limitPrice)) throw new Error("Preço ultrapassou o limite da estratégia");
      const executed = await db.rpc("execute_paper_copy_signal", { p_signal: signal.id, p_token: market.token, p_price: price, p_shares: shares });
      if (executed.error) throw executed.error;
    } catch (err) {
      const message = err instanceof Error ? err.message : err && typeof err === "object" && "message" in err ? String(err.message) : "Falha ao executar cópia";
      if (/indisponível|Fonte pública|Failed to fetch|timeout|Falha ao executar cópia/i.test(message)) { failures++; console.error("[paper-copy] retry", signal.id, message); continue; }
      const skipped = await db.from("paper_copy_signals").update({ status: "skipped", reason: message.slice(0, 240) }).eq("id", signal.id).eq("status", "approved");
      if (skipped.error) failures++;
    }
  }
  return Response.json({ strategies: strategies?.length ?? 0, queued: pending.data?.length ?? 0, failures }, { status: failures ? 207 : 200 });
}

Deno.serve(handlePaperCopyRequest);
