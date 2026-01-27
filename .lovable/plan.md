
# Implementação: Contratos NÃO Kalshi-Style para Multi-Mercados

## Resumo

Implementar lógica onde comprar "NÃO" em uma opção cria um contrato único que:
- **Ganha** R$1 por contrato se a opção NÃO vencer
- **Perde tudo** se a opção vencer

## Modelo de Risco

```text
┌─────────────────────────────────────────────────────────────────┐
│                    COMPRAR SIM ALPHA (R$30)                     │
├─────────────────────────────────────────────────────────────────┤
│ Preço: 30¢ por contrato = 100 contratos                         │
│                                                                 │
│ Se Alpha VENCER:                                                │
│   → Recebe R$100 (100 contratos × R$1)                         │
│   → Lucro: R$70                                                │
│                                                                 │
│ Se Alpha PERDER:                                                │
│   → Recebe R$0                                                 │
│   → Prejuízo: R$30 (100%)                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   COMPRAR NÃO ALPHA (R$70)                      │
├─────────────────────────────────────────────────────────────────┤
│ Preço: 70¢ por contrato (100% - 30%) = 100 contratos            │
│                                                                 │
│ Se Alpha PERDER (qualquer outro vencer):                        │
│   → Recebe R$100 (100 contratos × R$1)                         │
│   → Lucro: R$30                                                │
│                                                                 │
│ Se Alpha VENCER:                                                │
│   → Recebe R$0                                                 │
│   → Prejuízo: R$70 (100%)                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Mudanças no Banco de Dados

### 1. Nova Coluna `contract_type`

Adicionar coluna para diferenciar contratos SIM e NÃO:

```sql
ALTER TABLE user_contracts 
ADD COLUMN contract_type TEXT NOT NULL DEFAULT 'YES'
CHECK (contract_type IN ('YES', 'NO'));
```

### 2. Atualizar Índice Único

Permitir que usuário tenha SIM e NÃO na mesma opção:

```sql
DROP INDEX IF EXISTS idx_user_contracts_unique_position;
CREATE UNIQUE INDEX idx_user_contracts_unique_position ON user_contracts 
  (user_id, market_id, COALESCE(option_id::text, position), contract_type);
```

### 3. Nova Função SQL para Trade NÃO

```sql
CREATE OR REPLACE FUNCTION atomic_execute_multi_no_trade(
  p_user_id UUID,
  p_market_id UUID,
  p_option_id UUID,
  p_shares NUMERIC,
  p_max_cost NUMERIC
)
RETURNS JSONB
```

Lógica:
1. Calcular preço NÃO = (100% - preço_SIM_da_opção)
2. Verificar saldo disponível
3. Debitar wallet
4. Criar contrato com `contract_type = 'NO'`
5. Registrar transação

### 4. Atualizar Settlement

Modificar `process_market_payouts` para processar contratos NÃO:

```sql
-- Para cada contrato no mercado:
IF contract_type = 'YES' THEN
  -- Paga se option_id = vencedor
  IF option_id = winning_option THEN payout = shares × R$1
ELSIF contract_type = 'NO' THEN
  -- Paga se option_id ≠ vencedor
  IF option_id != winning_option THEN payout = shares × R$1
END IF;
```

## Mudanças no Frontend

### 1. MultiOptionPurchaseModal

Ajustar cálculo de custo para compras NÃO:

```typescript
// Preço NÃO = 100% - preço SIM
const price = side === 'YES' 
  ? option.currentPrice / 100 
  : (100 - option.currentPrice) / 100;
```

### 2. Edge Function execute-multi-trade

Adicionar suporte para `side: 'NO'`:

```typescript
if (side === 'NO') {
  // Chamar atomic_execute_multi_no_trade
} else {
  // Chamar atomic_execute_multi_trade (existente)
}
```

### 3. ContractsList

Exibir contratos NÃO com badge vermelho:

```tsx
{contract.contractType === 'NO' && (
  <Badge variant="destructive">NÃO</Badge>
)}
```

### 4. MultiOptionSellModal

Permitir venda de contratos NÃO (lógica inversa de preço).

## Pool e Taxa

### Cálculo do Pool

```text
Pool Disponível = Total Volume × (1 - rake%)

Exemplo com rake 5%:
- Volume total: R$10.000
- Rake: R$500 (lucro da plataforma)
- Pool disponível: R$9.500
```

### Proteção contra Over-Payout

Se payouts excedem o pool, proporcionalizar:

```sql
IF total_payouts > pool_disponivel THEN
  ratio := pool_disponivel / total_payouts;
  -- Cada payout *= ratio
END IF;
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Coluna `contract_type`, função `atomic_execute_multi_no_trade`, atualizar `process_market_payouts` |
| `execute-multi-trade/index.ts` | Rotear para função correta baseado em `side` |
| `MultiOptionPurchaseModal.tsx` | Calcular preço NÃO corretamente |
| `ContractsList.tsx` | Exibir badge NÃO |
| `MultiOptionSellModal.tsx` | Suporte para vender NÃO |
| `src/types/market.ts` | Adicionar `contractType` ao tipo `UserContract` |

## Fluxo Completo

```text
COMPRA NÃO:
1. Usuário clica "NÃO 70¢" em Alpha
2. Modal mostra: "Custo: R$70 = 100 contratos NÃO Alpha"
3. Confirma → execute-multi-trade(side: 'NO')
4. SQL cria: user_contracts(option=Alpha, type='NO', shares=100)
5. Wallet: -R$70

SETTLEMENT (Beta vence):
1. Admin marca Beta como vencedor
2. process_market_payouts verifica cada contrato:
   - SIM Alpha: option≠winner → R$0
   - SIM Beta: option=winner → R$1 × shares
   - NÃO Alpha: option≠winner → R$1 × shares ✓
   - NÃO Beta: option=winner → R$0
3. Distribui payouts do pool
```

## Estimativa

| Fase | Tempo |
|------|-------|
| Migração SQL (schema + funções) | 30 min |
| Edge function update | 20 min |
| Frontend (modal, contracts) | 40 min |
| Testes | 30 min |
| **Total** | **~2 horas** |
