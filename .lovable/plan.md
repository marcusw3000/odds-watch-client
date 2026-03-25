

# Melhorias Visuais: Gráfico Multi-Opção, Multiplicadores e Filtros de Tempo

## Contexto

A tabela `market_price_history` só armazena `yes_price`/`no_price` (binário). Para mercados multi-opção, não existe histórico por opção. O trigger `record_price_after_trade` grava apenas os preços binários do mercado.

Isso significa que precisamos de infraestrutura nova no banco de dados para suportar gráficos multi-opção.

## Plano

### 1. Migração: Adicionar `option_id` ao `market_price_history`

Adicionar coluna `option_id` (nullable, FK para `market_options`) e atualizar o trigger para gravar o preço de cada opção após trades multi-opção. Para mercados binários, `option_id` permanece `NULL`.

Atualizar a função `record_price_after_trade` para, quando o trade tiver `option_id`, buscar os preços de **todas** as opções do mercado e inserir um registro para cada uma.

### 2. `src/types/market.ts` — Novo tipo para histórico multi-opção

```ts
export interface MultiOptionHistoryPoint {
  timestamp: Date;
  prices: Record<string, number>; // option_id -> price (0-100)
}
```

### 3. `src/services/MarketDataProvider.ts` — Novo método `getMultiOptionHistory`

Buscar de `market_price_history` filtrado por `market_id` com `option_id IS NOT NULL`, agrupar por hora e retornar `MultiOptionHistoryPoint[]`.

### 4. `src/components/market/OddsChart.tsx` — Suportar multi-opção

Aceitar prop opcional `multiData` e `options` (lista de opções com labels/cores). Quando presente, renderizar uma `Area` por opção com cores distintas ao invés das linhas SIM/NÃO fixas.

Adicionar filtros de tempo (1H, 6H, 1D, 1S, 1M, Tudo) como botões acima do gráfico, filtrando os dados por timestamp.

### 5. `src/components/market/MultiOptionTradingPanel.tsx` — Multiplicadores

Trocar exibição dos botões de `SIM 29¢` / `NÃO 71¢` para `SIM 3.45x` / `NÃO 1.41x` (calculado como `100 / price`).

### 6. `src/pages/MarketDetailPage.tsx` — Integrar

Para mercados `MULTIPLE`, buscar `getMultiOptionHistory` e passar para o `OddsChart` com os dados das opções.

## Arquivos alterados

- **1 migração SQL** — coluna `option_id`, trigger atualizado
- `src/types/market.ts` — novo tipo
- `src/services/MarketDataProvider.ts` — novo método
- `src/components/market/OddsChart.tsx` — multi-linha + filtros de tempo
- `src/components/market/MultiOptionTradingPanel.tsx` — multiplicadores
- `src/pages/MarketDetailPage.tsx` — integração

