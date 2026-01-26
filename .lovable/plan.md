
# Plano de Otimização de Performance

## Diagnóstico Atual

O projeto já possui uma base sólida de otimizações:

| Categoria | Status Atual |
|-----------|--------------|
| Code Splitting | Lazy loading de todas as rotas |
| Memoization | `memo()` em componentes críticos (cards, badges) |
| Image Optimization | WebP + quality 60 para Supabase Storage |
| Layout Stability | `contain: layout` em containers principais |
| Chart Performance | Animações SVG desabilitadas |
| Realtime Updates | Supabase Realtime para markets |

---

## Oportunidades de Melhoria

### 1. Bundle Optimization (Impacto: Alto)

**Problema:** Algumas dependências pesadas são carregadas no bundle principal.

**Ações:**
- Configurar chunking manual no Vite para separar vendors
- Lazy load de `recharts` apenas nas páginas que usam gráficos
- Tree-shaking mais agressivo para `lucide-react` (importar ícones individualmente já está correto, mas verificar tree-shaking)

```typescript
// vite.config.ts - Adicionar build optimization
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-query': ['@tanstack/react-query'],
        'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', ...],
        'vendor-charts': ['recharts'],
        'vendor-supabase': ['@supabase/supabase-js'],
      }
    }
  }
}
```

---

### 2. React Query Optimization (Impacto: Alto)

**Problema:** Configuração padrão do QueryClient sem otimizações.

**Ações:**
- Configurar `staleTime` e `gcTime` globais
- Adicionar `refetchOnWindowFocus: false` para dados que não mudam frequentemente
- Implementar `placeholderData` para transições suaves

```typescript
// Antes (App.tsx)
const queryClient = new QueryClient();

// Depois
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s antes de considerar stale
      gcTime: 5 * 60 * 1000, // 5min no cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

---

### 3. Font Loading Optimization (Impacto: Médio)

**Problema:** Fontes carregadas via CSS `@import` bloqueiam renderização.

**Ações:**
- Mover para `<link rel="preload">` no `index.html`
- Adicionar `font-display: swap`
- Preconnect já existe, mas pode ser otimizado

```html
<!-- index.html -->
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
```

---

### 4. Virtualização para Listas Grandes (Impacto: Médio)

**Problema:** Com muitos mercados, todos os DOM nodes são renderizados.

**Ações:**
- Implementar `react-window` ou `@tanstack/react-virtual` para grids grandes (>50 items)
- Manter infinite scroll atual para casos normais

**Arquivo:** `src/pages/MarketsPage.tsx`

```typescript
// Adicionar virtualização condicional
import { useVirtualizer } from '@tanstack/react-virtual';

// Usar quando gridEvents.length > 50
const rowVirtualizer = useVirtualizer({
  count: gridEvents.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 280,
});
```

---

### 5. Prefetch de Dados Críticos (Impacto: Médio)

**Problema:** Dados carregados após navegação, causando delay.

**Ações:**
- Prefetch de detalhes do mercado no hover do card
- Prefetch de portfolio ao logar
- Prefetch de categorias no mount inicial

```typescript
// Em CompactMarketCard.tsx
const queryClient = useQueryClient();

const handleMouseEnter = () => {
  queryClient.prefetchQuery({
    queryKey: ['market', event.id],
    queryFn: () => MarketDataProvider.getEventById(event.id),
    staleTime: 60000,
  });
};
```

---

### 6. Image Loading Optimization (Impacto: Médio)

**Problema:** Imagens carregadas mesmo fora da viewport.

**Ações:**
- Adicionar `loading="lazy"` em imagens de cards
- Usar `IntersectionObserver` para lazy load de imagens em background
- Implementar placeholder blur para imagens

**Arquivo:** `src/components/market/cards/CardStyleDefault.tsx`

```typescript
// Adicionar loading lazy e fadeIn após load
<img 
  loading="lazy"
  decoding="async"
  src={optimizeImageUrl(event.imageUrl, { width: 80 })}
  className="transition-opacity duration-300"
/>
```

---

### 7. Debounce e Throttle de Atualizações (Impacto: Baixo)

**Problema:** Atualizações realtime podem causar re-renders excessivos.

**Ações:**
- Throttle de atualizações de preços (max 1/segundo por mercado)
- Debounce de search input (já implementado)
- Batch de atualizações de múltiplos mercados

**Arquivo:** `src/hooks/useMarketsRealtime.ts`

```typescript
// Adicionar throttle para updates
import { throttle } from 'lodash';

const throttledUpdate = throttle((payload) => {
  setEvents((prev) =>
    prev.map((e) => (e.id === payload.id ? transformPayload(payload) : e))
  );
}, 1000);
```

---

### 8. Service Worker para Cache Offline (Impacto: Baixo)

**Problema:** Sem cache offline para assets estáticos.

**Ações:**
- Implementar Workbox para PWA
- Cache de assets estáticos (JS, CSS, imagens)
- Cache de dados de mercados (stale-while-revalidate)

---

### 9. Memoização Adicional (Impacto: Baixo)

**Problema:** Alguns cálculos repetidos em cada render.

**Ações:**
- Memoizar `CategoryFilter` counts
- Memoizar transformações de dados em hooks

```typescript
// Em CategoryFilter.tsx
const sortedCategories = useMemo(() => 
  categories.sort((a, b) => (categoryCounts[b] || 0) - (categoryCounts[a] || 0)),
  [categories, categoryCounts]
);
```

---

## Arquivos a Modificar

| Prioridade | Arquivo | Mudança |
|------------|---------|---------|
| Alta | `vite.config.ts` | Manual chunks, build optimization |
| Alta | `src/App.tsx` | QueryClient config |
| Média | `index.html` | Font preload |
| Média | `src/pages/MarketsPage.tsx` | Virtualização condicional |
| Média | `src/components/market/cards/*.tsx` | Image lazy loading |
| Baixa | `src/hooks/useMarketsRealtime.ts` | Throttle updates |

---

## Métricas Esperadas

| Métrica | Atual (estimado) | Após Otimização |
|---------|------------------|-----------------|
| LCP | ~1.5s | <1.2s |
| FID | ~50ms | <30ms |
| CLS | 0 | 0 (manter) |
| Bundle Size | ~400KB | ~300KB |
| TTI | ~2s | <1.5s |

---

## Dependências Necessárias

```bash
# Opcional para virtualização
npm install @tanstack/react-virtual

# Opcional para PWA
npm install vite-plugin-pwa workbox-window
```

---

## Implementação Sugerida

1. **Fase 1 (Quick Wins):** QueryClient config, Font loading, Vite chunks
2. **Fase 2 (Core):** Virtualização, Prefetch, Image lazy
3. **Fase 3 (Polish):** Service Worker, Throttle, Memoização extra
