
# Sprint 3: Multi-option NÃO Trades + Comentários Realtime

## Visão Geral

Este sprint implementa duas funcionalidades importantes:
1. **P2.7** - Compra de "NÃO" em mercados de múltiplas opções
2. **P2.8** - Migração de comentários de mocks para banco de dados real com realtime

---

## P2.7 - Compra de NÃO em Mercados Múltiplos

### Problema Atual
Quando o usuário clica em "NÃO" para uma opção em um mercado de múltiplas opções (ex: "NÃO em Flamengo"), o sistema exibe "Em breve!" (linha 728-735 de `MarketDetailPage.tsx`).

### Solução
Comprar "NÃO" na opção X significa comprar "SIM" em **todas as outras opções** proporcionalmente ao preço de cada uma.

**Exemplo:**
- Mercado: "Quem será o campeão do Brasileirão?"
- Opções: Flamengo (25¢), Palmeiras (22¢), São Paulo (15¢), Outros (38¢)
- Usuário clica "NÃO" em Flamengo
- Sistema compra SIM proporcional em Palmeiras, São Paulo e Outros

### Arquivos a Modificar

#### 1. Backend: Nova Edge Function `execute-multi-trade-batch`
```
supabase/functions/execute-multi-trade-batch/index.ts
```
- Recebe: `marketId`, `excludeOptionId`, `totalCost`
- Calcula distribuição proporcional entre as outras opções
- Executa trades atômicos para cada opção
- Retorna array de contratos criados

#### 2. Backend: Nova função SQL `atomic_execute_multi_trade_batch`
Migração SQL para criar função que:
- Recebe array de opções com shares
- Executa todas as compras em uma única transação
- Garante consistência ACID

#### 3. Frontend: `MarketDetailPage.tsx`
- Remover toast "Em breve!"
- Chamar `execute-multi-trade-batch` quando side='NO'
- Exibir sucesso com lista de contratos criados

#### 4. Frontend: `MultiOptionPurchaseModal.tsx`
- Calcular custo total para NO (soma dos custos das outras opções)
- Exibir preview: "Você ganhará se qualquer uma vencer:"
- Mostrar distribuição proporcional

### Fluxo de Dados

```text
Usuário clica "NÃO em Flamengo" com R$10
                    ↓
MultiOptionPurchaseModal calcula distribuição:
  - Palmeiras: R$2.93 (22/75 do restante)
  - São Paulo: R$2.00 (15/75)
  - Outros: R$5.07 (38/75)
                    ↓
execute-multi-trade-batch
                    ↓
atomic_execute_multi_trade_batch (SQL)
  - Cria 3 contratos user_contracts
  - Debita wallet
  - Atualiza shares em market_options
  - Registra transactions e ledger_entries
                    ↓
Retorna array de contratos criados
```

---

## P2.8 - Migração de Comentários para Banco de Dados

### Problema Atual
- `MarketDataProvider.ts` linha 87: `const mockComments: Record<string, Comment[]> = {};`
- `getEventComments()` retorna array vazio (mock)
- Tabela `comments` existe no banco com 7 registros reais
- `CommentService.ts` já usa queries reais para CRUD, mas `MarketDataProvider` não usa

### Situação Atual (Já Funciona ✅)
Analisando o código, descobri que:
- `CommentSection.tsx` já usa `CommentService.getRootComments()` diretamente
- `CommentService.ts` já faz queries reais na tabela `comments`
- A função `getEventComments()` em `MarketDataProvider.ts` não é usada!

### O Que Falta
1. **Remover código morto**: Excluir `mockComments` e `getEventComments()` de `MarketDataProvider.ts`
2. **Adicionar Realtime**: Subscription para novos comentários aparecerem automaticamente

### Arquivos a Modificar

#### 1. `src/services/MarketDataProvider.ts`
- Remover linha 87: `const mockComments`
- Remover linhas 411-414: função `getEventComments()`

#### 2. `src/components/market/CommentSection.tsx`
Adicionar subscription realtime:
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`comments:${marketId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `market_id=eq.${marketId}` },
      (payload) => {
        // Adicionar novo comentário à lista (se não for do próprio usuário)
        if (payload.new.user_id !== user?.id) {
          loadComments();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [marketId, user?.id]);
```

---

## Cronograma de Implementação

| Tarefa | Arquivos | Esforço |
|--------|----------|---------|
| 1. Edge Function execute-multi-trade-batch | `supabase/functions/execute-multi-trade-batch/index.ts` | 2h |
| 2. SQL atomic_execute_multi_trade_batch | Migração | 1h |
| 3. Atualizar MarketDetailPage para NO | `src/pages/MarketDetailPage.tsx` | 30min |
| 4. Atualizar MultiOptionPurchaseModal | `src/components/market/MultiOptionPurchaseModal.tsx` | 1h |
| 5. Remover mocks de comentários | `src/services/MarketDataProvider.ts` | 15min |
| 6. Adicionar realtime aos comentários | `src/components/market/CommentSection.tsx` | 30min |
| 7. Testes e validação | - | 1h |

**Total estimado: ~6 horas**

---

## Seção Técnica

### Edge Function: execute-multi-trade-batch

```typescript
interface MultiTradeBatchRequest {
  marketId: string;
  excludeOptionId: string;   // Opção que o usuário NÃO quer
  totalCost: number;         // Valor total a investir
  maxSlippage?: number;
}

// Lógica principal:
// 1. Buscar todas as opções do mercado
// 2. Filtrar a opção excluída
// 3. Calcular distribuição proporcional por preço
// 4. Chamar atomic_execute_multi_trade_batch
```

### SQL: atomic_execute_multi_trade_batch

```sql
CREATE OR REPLACE FUNCTION atomic_execute_multi_trade_batch(
  p_user_id UUID,
  p_market_id UUID,
  p_trades JSONB  -- Array de {option_id, shares}
) RETURNS JSONB AS $$
DECLARE
  v_trade JSONB;
  v_total_cost NUMERIC := 0;
  v_results JSONB := '[]'::JSONB;
BEGIN
  -- Validar saldo disponível
  -- Loop por cada trade
  FOR v_trade IN SELECT * FROM jsonb_array_elements(p_trades)
  LOOP
    -- Chamar atomic_execute_multi_trade para cada opção
    -- Acumular resultados
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'contracts', v_results,
    'total_cost', v_total_cost
  );
END;
$$ LANGUAGE plpgsql;
```

### Cálculo de Distribuição Proporcional

```typescript
// Dado:
// - excludeOption.currentPrice = 25 (Flamengo)
// - otherOptions = [{id: 'palm', price: 22}, {id: 'sp', price: 15}, {id: 'outros', price: 38}]
// - totalCost = 10

const priceSum = otherOptions.reduce((sum, opt) => sum + opt.currentPrice, 0);
// priceSum = 22 + 15 + 38 = 75

const trades = otherOptions.map(opt => ({
  optionId: opt.id,
  allocation: totalCost * (opt.currentPrice / priceSum),
  // palm: 10 * (22/75) = 2.93
  // sp: 10 * (15/75) = 2.00
  // outros: 10 * (38/75) = 5.07
}));
```

---

## Verificações de Segurança

1. **RLS**: Tabela `comments` já tem políticas para usuários autenticados
2. **Validação**: Edge function valida autenticação antes de processar
3. **Atomicidade**: Transação SQL garante consistência dos trades batch
4. **Limites**: Respeitar `minBuy`/`maxBuy` do mercado
