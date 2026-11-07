import type { FxQuote } from "@/types/fx";

const BCB_PTAX_URL = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)";
const CACHE_TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_LOOKBACK_DAYS = 7;

let cachedQuote: { expiresAt: number; value: FxQuote } | null = null;

function formatBcbDate(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}-${day}-${date.getUTCFullYear()}`;
}

function referenceDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export async function getUsdBrlFxQuote(): Promise<FxQuote> {
  if (cachedQuote && cachedQuote.expiresAt > Date.now()) return cachedQuote.value;

  for (let offset = 1; offset <= MAX_LOOKBACK_DAYS; offset += 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    if (isWeekend(date)) continue;

    const url = new URL(BCB_PTAX_URL);
    url.searchParams.set("@dataCotacao", `'${formatBcbDate(date)}'`);
    url.searchParams.set("$format", "json");
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) continue;

    const payload: unknown = await response.json();
    const rows = payload && typeof payload === "object" && Array.isArray((payload as { value?: unknown }).value)
      ? (payload as { value: unknown[] }).value : [];
    const latest = rows[rows.length - 1];
    const rate = latest && typeof latest === "object" ? Number((latest as { cotacaoVenda?: unknown }).cotacaoVenda) : NaN;
    if (!Number.isFinite(rate) || rate <= 0) continue;

    const value: FxQuote = {
      baseCurrency: "USD", quoteCurrency: "BRL", rate: String(rate),
      source: "Banco Central do Brasil - PTAX venda", referenceDate: referenceDate(date), fetchedAt: new Date().toISOString(),
    };
    cachedQuote = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  throw new Error("No USD/BRL PTAX quote was available from Banco Central do Brasil");
}
