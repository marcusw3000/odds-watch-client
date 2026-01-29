
# Plano: Corrigir Erro de Enum e Reprocessar Payouts

## Problema Identificado

A função `process_market_payouts` falha ao inserir notificações porque usa `'market_settled'` (minúsculo), mas o enum `notification_type` requer `'MARKET_SETTLED'` (maiúsculo).

Este erro causa a falha de toda a transação, resultando em:
- Nenhum wallet creditado
- Nenhuma entrada no ledger
- Nenhuma notificação enviada
- Contratos permanecem com shares > 0

### Evidência do Erro

```text
Logs do Postgres:
ERROR: invalid input value for enum notification_type: "market_settled"
```

### Mercados Afetados

| Mercado | Tipo | Resultado Registrado | Payouts | Status |
|---------|------|---------------------|---------|--------|
| Teste | MULTIPLE | YES (incorreto) | 0 | ❌ Precisa UUID |
| Teste LMSR | MULTIPLE | YES (incorreto) | 0 | ❌ Precisa UUID |
| Taxa CDI | BINARY | YES | 0 | ❌ Falhou no enum |
| Taxa SELIC | BINARY | YES | 4 | ✅ Funcionou antes da migração |

## Solução

### Migração SQL

Atualizar a função `process_market_payouts` para usar o valor correto do enum:

```text
ANTES:  'market_settled'
DEPOIS: 'MARKET_SETTLED'
```

A correção é simples - apenas trocar 2 ocorrências de `'market_settled'` por `'MARKET_SETTLED'` na função.

---

## Detalhes Técnicos

A migração SQL irá:

1. Dropar a função existente `process_market_payouts`
2. Recriar com o enum correto `'MARKET_SETTLED'`
3. Manter toda a lógica de payouts intacta

### Locais da Correção

```sql
-- Linha ~78-85 (multi-option winners)
INSERT INTO notifications (user_id, type, title, message, data)
VALUES (
  v_contract.user_id,
  'MARKET_SETTLED',  -- ANTES: 'market_settled'
  ...
);

-- Linha ~133-140 (multi-option NO winners)
INSERT INTO notifications (user_id, type, title, message, data)
VALUES (
  v_contract.user_id,
  'MARKET_SETTLED',  -- ANTES: 'market_settled'
  ...
);

-- Linha ~208-215 (binary winners)
INSERT INTO notifications (user_id, type, title, message, data)
VALUES (
  v_contract.user_id,
  'MARKET_SETTLED',  -- ANTES: 'market_settled'
  ...
);
```

---

## Reprocessamento de Mercados Afetados

Após a correção, os mercados que falharam podem ser reprocessados manualmente:

**Para mercado BINARY (Taxa CDI):**
```sql
SELECT process_market_payouts(
  '01f42911-f2d8-416f-b7e1-204a35d29601'::uuid, 
  'YES'
);
```

**Para mercados MULTIPLE:**
Será necessário atualizar o campo `result` com o UUID da opção vencedora e então chamar a função. Isso requer que o administrador:
1. Identifique qual opção realmente venceu
2. Execute uma query para corrigir o `result` 
3. Chame `process_market_payouts` com o UUID correto

---

## Resultado Esperado

Após a migração:
1. Novos settlements funcionarão corretamente
2. Ledger entries serão criados
3. Wallets serão creditados
4. Notificações serão enviadas
5. Stats de perfil serão atualizados
