
Objetivo: implementar (e deixar robusta) a compra de **NÃO** em mercados **MULTIPLE** (“multi-mercado”) no app, eliminando o erro recorrente `Preço excedeu o custo máximo permitido` ao executar o batch.

## 1) Diagnóstico do estado atual (com base no código)
### Frontend (já existe fluxo de NÃO)
- `MultiOptionPurchaseModal.tsx`: quando `side === 'NO'`, usa `MultiOptionNoPurchaseContent` para o usuário informar um **valor total em R$** e um **slippage**.
- `MarketDetailPage.tsx` (linhas ~725+): para `side === 'NO'`, chama a Edge Function `execute-multi-trade-batch` enviando:
  - `marketId`
  - `excludeOptionId` (opção clicada como “NÃO”)
  - `totalCost` (valor em R$)
  - `maxSlippage`

### Backend (onde o erro nasce)
- Edge Function `execute-multi-trade-batch` apenas valida e chama `rpc('atomic_execute_multi_trade_batch', ...)`.
- SQL `atomic_execute_multi_trade_batch` (migração `20260127151237...`) **estima shares** com:
  - `v_shares_estimate := v_allocation / (current_price/100)`
  - e executa `atomic_execute_multi_trade(..., p_shares=v_shares_estimate, p_max_cost=v_option_max_cost)`
- Problema: em LMSR, **custo não é linear** (depende do estado/curva). Essa estimativa de shares frequentemente produz um custo real maior que `p_max_cost`, disparando `Preço excedeu o custo máximo permitido`.

Conclusão: o fluxo de NÃO está “implementado” no UI + Edge Function, mas falta a parte crítica: o batch SQL precisa comprar por **budget (R$)** de forma consistente em LMSR.

---

## 2) Solução proposta (robusta): “comprar por custo”, não por shares estimado
### Mudança principal
Atualizar `atomic_execute_multi_trade_batch` para, para cada opção a ser comprada (todas exceto a excluída):
1. Definir um **budget** (alocação) em R$ para aquela opção (proporcional ao preço ou outra regra).
2. Calcular **quantas shares cabem naquele budget** usando LMSR (via `calculate_multi_lmsr_cost`) com **busca binária (binary search)**.
3. Chamar `atomic_execute_multi_trade` com:
   - `p_shares` = shares calculadas pela busca binária
   - `p_max_cost` = budget máximo permitido para aquela opção (considerando limite por-opção e o orçamento restante)

Isso faz com que a checagem de slippage de `atomic_execute_multi_trade` deixe de falhar por “chute errado” de shares.

---

## 3) Detalhes de implementação (SQL)
### 3.1 Onde mudar
- Criar uma nova migração SQL que substitui `atomic_execute_multi_trade_batch` (CREATE OR REPLACE).

### 3.2 Algoritmo por opção (em alto nível)
Para cada `v_opt`:
1. `v_allocation := p_total_cost * (v_opt.current_price / v_total_price)`
2. Definir `v_option_budget_max := LEAST(v_remaining_budget, v_allocation * (1 + internal_buffer))`
   - `internal_buffer` pode continuar em 0.20 para absorver impacto cumulativo
3. Calcular `v_shares_to_buy` por busca binária:
   - Montar `v_all_shares` atual (ORDER BY display_order)
   - Encontrar `v_option_index` do `v_opt`
   - Definir função “custo para shares X”:
     - `cost(X) = calculate_multi_lmsr_cost(shares_with_added_X) - calculate_multi_lmsr_cost(shares_current)`
   - Buscar o maior `X` tal que `cost(X) <= v_option_budget_max`
   - Regras:
     - se `v_option_budget_max` for muito baixo, pular
     - limitar iterações (ex: 40-60) e epsilon (ex: 0.0001)
4. Executar:
   - `atomic_execute_multi_trade(p_user_id, p_market_id, v_opt.id, v_shares_to_buy, v_option_budget_max)`
5. Atualizar:
   - `v_actual_total_cost += trade_cost`
   - `v_remaining_budget -= trade_cost`

### 3.3 Considerações importantes
- “Dados frescos”: dentro do loop, ler `market_options` com locks adequados (o `atomic_execute_multi_trade` já dá `FOR UPDATE` em market + options; mas o batch deve evitar usar arrays stale).
- Ordem das compras:
  - manter ordem atual por `display_order` (determinístico)
  - opcional: comprar primeiro as opções com maior peso para reduzir risco de sobrar “poeira” de budget
- Retorno `contracts`:
  - manter formato atual usado pelo frontend (lista com `option_id`, `option_label`, `shares`, `cost`, `contract_id`).
- Erros:
  - se uma opção não conseguir comprar nada (budget muito pequeno), ela pode ser “skipada”.
  - se qualquer compra falhar por razões reais (saldo, mercado fechado, etc.), retornar erro claro.

---

## 4) Ajustes no Backend (Edge Function)
A Edge Function `execute-multi-trade-batch` pode permanecer quase igual.
Mudanças recomendadas:
- Melhorar mensagens retornadas:
  - quando RPC falhar: incluir `tradeError.details`/`hint` se houver
  - quando `result.success=false`: retornar `result.error` como message (já faz)
- (Opcional) Logar:
  - `totalCost`, `maxSlippage`, quantidade de opções envolvidas
  - custo total final

---

## 5) Ajustes no Frontend (mínimos, para UX + resiliência)
O fluxo já existe. Ajustes recomendados:
1. No `MultiOptionNoPurchaseContent`, permitir valores rápidos e manter o mínimo (R$10) alinhado ao backend.
2. Se vier erro “Preço excedeu...” ainda (depois do fix SQL, deve cair muito):
   - Mostrar mensagem “Preço mudou, atualizando…” e forçar refresh de odds (já existe lógica de slippage).
3. Após sucesso, além do toast, atualizar explicitamente:
   - carteira / portfólio / contratos (hoje já faz `triggerPortfolioRefresh()` + `handleRefreshPrice()`; validar se o saldo local do usuário é recarregado ou apenas ajustado).

---

## 6) Plano de validação (teste manual orientado)
1. No mercado da rota fornecida `/market/260e14e8-7b45-42fc-948a-e5100876d712`:
   - Clique “NÃO” em uma opção com várias outras opções
   - Tente `R$10`, `R$25`, `R$50` com slippage 5%
2. Confirmar que:
   - Não retorna 400 “Preço excedeu…”
   - O total debitado fica `<= totalCost*(1+maxSlippage)` (regra de orçamento total)
   - Contratos foram criados para as outras opções
3. Repetir em sequência (2-3 compras seguidas) para garantir estabilidade sob impacto cumulativo.

---

## 7) Entregáveis (o que será implementado ao aprovar)
- Nova migração SQL substituindo `atomic_execute_multi_trade_batch` para:
  - calcular shares por budget via busca binária usando `calculate_multi_lmsr_cost`
  - eliminar a estimativa linear por `current_price`
- Pequenas melhorias de logging/mensagens na Edge Function (opcional, mas recomendado)
- Pequenos ajustes de UX no frontend para NO (se necessário)

---

## Perguntas (somente se você quiser definir comportamento)
Nenhuma decisão bloqueia o conserto. Porém, se quiser, posso alinhar:
- A distribuição do budget no “NÃO” deve ser proporcional ao `current_price` (como hoje) ou proporcional a outra métrica (ex: liquidez/shares)? (O padrão atual é ok e manterei igual.)

