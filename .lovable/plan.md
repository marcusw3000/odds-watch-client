
# Correção do Sistema Financeiro - Visão Geral Admin

## Problemas Identificados

| Problema | Causa | Impacto |
|----------|-------|---------|
| Receita R$ 0,00 | Tabela `platform_revenue` vazia | Cards de receita zerados |
| Taxa média R$ 0,00 | `fee_amount = 0` em ledger_entries | Indicadores incorretos |
| Gráficos vazios | Sem dados de receita | UI quebrada |
| Taxas não cobradas | Função `atomic_execute_trade` não aplica fee_rules | Perda de receita |

---

## Solução Proposta

### Fase 1: Aplicar Taxas nos Trades (Banco de Dados)

**Alterar a função `atomic_execute_trade` para:**
1. Buscar a regra de taxa ativa para TRADE
2. Calcular o fee baseado na regra (1% conforme configurado)
3. Gravar `fee_amount` e `platform_revenue` no `ledger_entries`
4. Inserir registro na tabela `platform_revenue`

```sql
-- Dentro da função atomic_execute_trade, adicionar:
DECLARE
  v_fee_rule RECORD;
  v_fee_amount numeric := 0;
  v_net_amount numeric;

-- Buscar regra de taxa ativa
SELECT * INTO v_fee_rule 
FROM fee_rules 
WHERE type = 'TRADE' AND is_active = true 
ORDER BY effective_from DESC 
LIMIT 1;

-- Calcular taxa (modo PERCENT)
IF FOUND AND v_fee_rule.mode = 'PERCENT' THEN
  v_fee_amount := v_trade_cost * COALESCE(v_fee_rule.percent_value, 0);
END IF;

v_net_amount := v_trade_cost - v_fee_amount;

-- Inserir no ledger com fee
INSERT INTO ledger_entries (
  user_id, wallet_id, amount, fee_amount, net_amount, 
  platform_revenue, direction, ref_type, ref_id, status
) VALUES (
  p_user_id, v_wallet.id, v_trade_cost, v_fee_amount, v_net_amount,
  v_fee_amount, 'DEBIT', 'TRADE', p_market_id, 'COMPLETED'
);

-- Acumular receita da plataforma
INSERT INTO platform_revenue (day, type, gross, fees, net)
VALUES (CURRENT_DATE, 'TRADE', v_trade_cost, v_fee_amount, v_net_amount)
ON CONFLICT (day, type) 
DO UPDATE SET 
  gross = platform_revenue.gross + EXCLUDED.gross,
  fees = platform_revenue.fees + EXCLUDED.fees,
  net = platform_revenue.net + EXCLUDED.net,
  updated_at = now();
```

---

### Fase 2: Melhorar a UI para Estados Vazios

**Arquivo: `src/pages/admin/AdminFinancialOverview.tsx`**

1. Adicionar mensagem quando gráficos estão vazios
2. Mostrar skeleton/placeholder enquanto não há dados
3. Exibir alerta informativo se não houver receita registrada

```tsx
// Para o AreaChart vazio
{revenueByDay.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
    <TrendingUp className="h-12 w-12 mb-2 opacity-50" />
    <p>Nenhuma receita registrada nos últimos 14 dias</p>
  </div>
) : (
  <ResponsiveContainer>...</ResponsiveContainer>
)}

// Para o PieChart vazio
{pieData.length === 0 ? (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
    <Activity className="h-12 w-12 mb-2 opacity-50" />
    <p>Nenhuma receita por tipo registrada</p>
  </div>
) : (
  <ResponsiveContainer>...</ResponsiveContainer>
)}
```

---

### Fase 3: Aplicar Taxas em Depósitos e Saques

Seguir o mesmo padrão nas edge functions:
- `create-deposit/index.ts` 
- `request-withdrawal/index.ts`

Buscar a regra de taxa ativa e aplicar antes de completar a transação.

---

## Detalhes Técnicos

### Tabela `platform_revenue` - Estrutura Esperada

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| day | date | Data da receita |
| type | text | TRADE, DEPOSIT, WITHDRAW, SETTLEMENT |
| gross | numeric | Valor bruto transacionado |
| fees | numeric | Taxa cobrada |
| net | numeric | Valor líquido |

### Constraint de Unicidade

```sql
ALTER TABLE platform_revenue 
ADD CONSTRAINT platform_revenue_day_type_unique 
UNIQUE (day, type);
```

Isso permite usar `ON CONFLICT` para acumular valores no mesmo dia.

---

## Ordem de Execução

1. **Migração SQL**: Atualizar função `atomic_execute_trade`
2. **Migração SQL**: Adicionar constraint unique em `platform_revenue`
3. **Edge Functions**: Atualizar depósitos e saques
4. **Frontend**: Melhorar tratamento de estados vazios

---

## Resultado Esperado

Após implementação:
- ✅ Taxas cobradas automaticamente (1% em trades)
- ✅ Receita acumulada diariamente na `platform_revenue`
- ✅ Cards de receita com valores reais
- ✅ Gráficos populados com dados históricos
- ✅ Estados vazios com mensagens informativas
