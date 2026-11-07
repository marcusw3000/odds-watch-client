import { createContext, useContext, useMemo } from "react";

type CurrencyContextValue = {
  usdBrlRate: number | null;
  formatUsdFromBrl: (value: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  usdBrlRate,
  children,
}: {
  usdBrlRate?: number | null;
  children: React.ReactNode;
}) {
  const value = useMemo<CurrencyContextValue>(() => {
    const rate = Number.isFinite(usdBrlRate) && (usdBrlRate ?? 0) > 0 ? Number(usdBrlRate) : null;
    return {
      usdBrlRate: rate,
      formatUsdFromBrl: (amount) => {
        if (!rate) return "US$ —";
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(amount / rate);
      },
    };
  }, [usdBrlRate]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useDisplayCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    return {
      usdBrlRate: null,
      formatUsdFromBrl: (_amount: number) => "US$ —",
    } satisfies CurrencyContextValue;
  }
  return context;
}
