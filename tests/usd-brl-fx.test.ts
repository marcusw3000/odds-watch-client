import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("USD/BRL PTAX provider", () => {
  it("falls back to an earlier date when the latest quote is unavailable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ cotacaoVenda: 5.42 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { getUsdBrlFxQuote } = await import("@/services/UsdBrlFxProvider.server");
    const quote = await getUsdBrlFxQuote();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(quote).toMatchObject({
      baseCurrency: "USD",
      quoteCurrency: "BRL",
      rate: "5.42",
      source: "Banco Central do Brasil - PTAX venda",
    });
  });
});
