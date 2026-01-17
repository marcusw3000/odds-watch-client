# Plano: Corrigir Sistema de Estatísticas e Conquistas

## Problema Identificado

As funções `atomic_execute_trade` e `atomic_execute_sell` executam trades corretamente, mas:
1. **Nao atualizam as estatisticas** na tabela `profiles` (total_trades, total_volume, etc.)
2. **Nao chamam `check_and_grant_achievements`** para verificar conquistas
3. O ranking/leaderboard fica zerado porque as estatisticas nunca sao atualizadas

### Evidencia do Problema:
- Usuario tem 3 trades com R$1019.50 de volume, mas `profiles.total_trades = 0`
- Todos usuarios no sistema tem estatisticas zeradas apesar de terem feito trades

## Solucao Proposta

### Etapa 1: Atualizar `atomic_execute_trade` para incluir estatisticas

Adicionar no final da funcao (antes do RETURN):

```sql
-- Atualizar estatisticas do usuario
UPDATE profiles SET
  total_trades = total_trades + 1,
  total_volume = total_volume + v_trade_cost,
  updated_at = now()
WHERE id = p_user_id;

-- Verificar e conceder conquistas
PERFORM check_and_grant_achievements(p_user_id);
```

### Etapa 2: Atualizar `atomic_execute_sell` para calcular lucro/prejuizo

```sql
-- Calcular lucro/prejuizo da venda
v_cost_basis := v_contract.average_price * p_shares;
v_profit := v_sell_value - v_cost_basis;
v_is_winning := v_profit > 0;

-- Atualizar estatisticas
UPDATE profiles SET
  total_trades = total_trades + 1,
  total_volume = total_volume + v_sell_value,
  total_profit = total_profit + v_profit,
  winning_trades = winning_trades + CASE WHEN v_is_winning THEN 1 ELSE 0 END,
  current_streak = CASE WHEN v_is_winning THEN current_streak + 1 ELSE 0 END,
  best_streak = GREATEST(best_streak, CASE WHEN v_is_winning THEN current_streak + 1 ELSE current_streak END),
  best_trade_profit = GREATEST(best_trade_profit, v_profit),
  roi_percent = CASE 
    WHEN total_volume > 0 THEN ((total_profit + v_profit) / total_volume) * 100 
    ELSE 0 
  END,
  updated_at = now()
WHERE id = p_user_id;

-- Verificar conquistas
PERFORM check_and_grant_achievements(p_user_id);
```

### Etapa 3: Criar funcao para recalcular estatisticas historicas

Para corrigir dados existentes, criar funcao:

```sql
CREATE OR REPLACE FUNCTION recalculate_user_statistics(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_stats RECORD;
BEGIN
  -- Calcular estatisticas a partir de transactions
  SELECT 
    COUNT(*) as total_trades,
    COALESCE(SUM(total_amount), 0) as total_volume,
    COALESCE(SUM(CASE WHEN type = 'SELL' THEN total_amount ELSE -total_amount END), 0) as net_profit
  INTO v_stats
  FROM transactions
  WHERE user_id = p_user_id;

  UPDATE profiles SET
    total_trades = v_stats.total_trades,
    total_volume = v_stats.total_volume,
    updated_at = now()
  WHERE id = p_user_id;
  
  PERFORM check_and_grant_achievements(p_user_id);
END;
$$;

-- Executar para todos usuarios existentes
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN SELECT DISTINCT user_id FROM transactions LOOP
    PERFORM recalculate_user_statistics(v_user_id);
  END LOOP;
END;
$$;
```

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| SQL Migration | Atualizar `atomic_execute_trade` |
| SQL Migration | Atualizar `atomic_execute_sell` |
| SQL Migration | Criar `recalculate_user_statistics` |
| SQL Migration | Executar recalculo para dados historicos |

## Fluxo Apos Correcao

```
Usuario executa trade
        |
        v
atomic_execute_trade
        |
        +-- Atualiza wallets
        +-- Cria contract
        +-- Atualiza profiles (total_trades, total_volume)
        +-- Chama check_and_grant_achievements()
        |
        v
   Leaderboard atualizado
   Conquistas verificadas
```

## Resultado Esperado

1. Cada novo trade incrementa automaticamente as estatisticas
2. Vendas calculam lucro/prejuizo e atualizam estatisticas
3. Conquistas sao verificadas e concedidas automaticamente
4. Dados historicos serao recalculados na migracao
5. Leaderboard mostrara rankings corretos