
# Plano de Otimização de LCP (8416ms → <2500ms)

## Diagnóstico do Problema

O LCP de 8416ms é classificado como **"poor"** pelo Google (bom: <2.5s, precisa melhorar: 2.5-4s, ruim: >4s). 

### Gargalos Identificados

| Gargalo | Impacto | Causa |
|---------|---------|-------|
| **N+1 Queries no PriceSparkline** | Alto | Cada card dispara query individual para `market_price_history` |
| **Auth check síncrono** | Alto | 150ms delay artificial + RPC `has_role` bloqueante |
| **Layout.tsx waterfall** | Médio | `getUserPortfolio()` + balance fetch sequenciais |
| **TrendingMarketCard Recharts** | Médio | Biblioteca pesada carregada mesmo sem dados |
| **Imagens sem lazy loading nativo** | Médio | Background-image não usa loading="lazy" |

---

## Fase 1: Eliminar N+1 Queries (Impacto: Muito Alto)

### Problema
Cada `PriceSparkline` no grid faz uma query separada:
```typescript
// PriceSparkline.tsx - linha 29-44
useEffect(() => {
  const fetchHistory = async () => {
    await supabase.from('market_price_history')...
  };
  fetchHistory();
}, [eventId]);
```

Com 8 mercados visíveis = 8 queries paralelas + overhead.

### Solução
Criar um hook centralizado que faz **batch fetch** de todos os sparklines de uma vez.

**Novo arquivo:** `src/hooks/usePriceHistoryBatch.ts`

```typescript
// Hook que faz prefetch de histórico para múltiplos mercados
export function usePriceHistoryBatch(marketIds: string[]) {
  return useQuery({
    queryKey: ['price-history-batch', marketIds.sort().join(',')],
    queryFn: async () => {
      const { data } = await supabase
        .from('market_price_history')
        .select('market_id, yes_price, recorded_at')
        .in('market_id', marketIds)
        .order('recorded_at', { ascending: true });
      
      // Agrupar por market_id
      const grouped: Record<string, PricePoint[]> = {};
      data?.forEach(row => {
        if (!grouped[row.market_id]) grouped[row.market_id] = [];
        grouped[row.market_id].push(row);
      });
      return grouped;
    },
    staleTime: 60000,
    enabled: marketIds.length > 0,
  });
}
```

**Modificar:** `MarketsPage.tsx`
- Prefetch histórico para todos os mercados visíveis em uma query
- Passar dados via Context para os PriceSparkline

**Modificar:** `PriceSparkline.tsx`
- Receber dados via props em vez de fazer fetch próprio
- Remover useEffect com fetch individual

---

## Fase 2: Otimizar Auth Check (Impacto: Alto)

### Problema
```typescript
// useAuth.ts - linha 52
await new Promise(resolve => setTimeout(resolve, 150)); // Delay artificial!
```

E depois ainda faz RPC síncrono para verificar admin role.

### Solução

**Modificar:** `src/hooks/useAuth.ts`

1. Remover delay de 150ms - desnecessário com Supabase PKCE
2. Fazer `has_role` RPC em paralelo com session check, não sequencial
3. Usar cache do React Query para admin status

```typescript
// Antes: sequencial com delay
await new Promise(resolve => setTimeout(resolve, 150));
const session = await supabase.auth.getSession();
if (session) await checkAdminRole(session.user.id); // Síncrono!

// Depois: paralelo sem delay
const session = await supabase.auth.getSession();
// Admin check é feito no onAuthStateChange com setTimeout(0)
// Já está correto, só precisa remover o delay de 150ms
```

---

## Fase 3: Otimizar Layout Waterfall (Impacto: Médio)

### Problema
```typescript
// Layout.tsx
useEffect(() => {
  fetchBalance(); // Dispara após mount
  const interval = setInterval(() => fetchBalance(false), 15000);
}, [fetchBalance]);
```

O balance é buscado **depois** que o Layout monta, causando cascade.

### Solução

**Modificar:** `src/components/layout/Layout.tsx`

1. Usar React Query para cache do balance
2. Mostrar skeleton/placeholder imediato para o header
3. Prefetch balance durante loading da app

```typescript
// Usar React Query com suspense-like behavior
const { data: userBalance, isLoading: isBalanceLoading } = useQuery({
  queryKey: ['user-balance'],
  queryFn: async () => {
    const portfolio = await MarketDataProvider.getUserPortfolio();
    return portfolio.balance;
  },
  staleTime: 10000,
  refetchInterval: 15000,
});
```

---

## Fase 4: Lazy Load Recharts (Impacto: Médio)

### Problema
O `TrendingMarketCard` importa Recharts no bundle principal mesmo que o chart não seja mostrado (mercados sem histórico).

### Solução

**Modificar:** `src/components/market/TrendingMarketCard.tsx`

1. Lazy load do componente de chart
2. Só carregar Recharts quando há dados

```typescript
// Lazy load chart component
const LazyPriceChart = lazy(() => import('./TrendingPriceChart'));

// No JSX
{hasEnoughData ? (
  <Suspense fallback={<ChartSkeleton />}>
    <LazyPriceChart data={priceHistory} />
  </Suspense>
) : (
  <NoDataPlaceholder />
)}
```

**Novo arquivo:** `src/components/market/TrendingPriceChart.tsx`
- Extrair apenas a parte do Recharts para chunk separado

---

## Fase 5: Imagens com Native Lazy Loading (Impacto: Baixo-Médio)

### Problema
Cards usam `background-image` CSS que não suporta lazy loading nativo.

### Solução

**Modificar:** `src/components/market/cards/CardStyleDefault.tsx` (e outros)

Trocar `background-image` por `<img>` com `loading="lazy"`:

```typescript
// Antes
<div style={{ backgroundImage: `url(${optimizeImageUrl(...)})` }} />

// Depois
<img 
  src={optimizeImageUrl(event.imageUrl, { width: 80 })}
  loading="lazy"
  decoding="async"
  alt=""
  className="absolute inset-0 w-full h-full object-cover"
/>
```

---

## Arquivos a Modificar

| Prioridade | Arquivo | Mudança |
|------------|---------|---------|
| Alta | `src/hooks/usePriceHistoryBatch.ts` | Criar hook de batch fetch |
| Alta | `src/pages/MarketsPage.tsx` | Integrar batch fetch |
| Alta | `src/components/market/PriceSparkline.tsx` | Receber dados via props |
| Alta | `src/hooks/useAuth.ts` | Remover delay de 150ms |
| Média | `src/components/layout/Layout.tsx` | Usar React Query para balance |
| Média | `src/components/market/TrendingMarketCard.tsx` | Lazy load Recharts |
| Média | `src/components/market/TrendingPriceChart.tsx` | Criar componente separado |
| Baixa | `src/components/market/cards/*.tsx` | Usar `<img loading="lazy">` |

---

## Métricas Esperadas

| Métrica | Atual | Após Otimização |
|---------|-------|-----------------|
| LCP | 8416ms | <2500ms |
| Queries iniciais | 8+ (N+1) | 2 (batch) |
| Auth delay | 150ms | 0ms |
| Bundle (charts) | Síncrono | Lazy |

---

## Ordem de Implementação

1. **Batch fetch para sparklines** - Maior impacto, elimina N+1
2. **Remover delay de auth** - Quick fix, 150ms imediato
3. **React Query para balance** - Elimina waterfall
4. **Lazy load Recharts** - Reduz bundle inicial
5. **Native img lazy loading** - Polish final

