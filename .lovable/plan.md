

# Vulnerabilidades Criticas Restantes -- Analise Completa

## Estado Atual dos Grants (pos-migrations anteriores)

A migration anterior removeu com sucesso os grants de `anon` em todas as tabelas e de `authenticated` em 8 tabelas criticas. Porem, **24 tabelas ainda possuem INSERT/UPDATE/DELETE para `authenticated`**, incluindo varias que deveriam ser restritas apenas a `service_role`.

## Vulnerabilidades Encontradas

### CRITICA 1: Escalacao de Privilegios via `raw_user_meta_data` (event_templates)

As 4 policies da tabela `event_templates` usam:
```text
EXISTS (SELECT 1 FROM auth.users u 
  WHERE u.id = auth.uid() 
  AND u.raw_user_meta_data ->> 'role' = 'admin')
```

O problema: usuarios podem modificar seu proprio `raw_user_meta_data` chamando `supabase.auth.updateUser({ data: { role: 'admin' } })` no console do navegador. Combinado com o fato de que `authenticated` tem INSERT/UPDATE/DELETE nesta tabela, **qualquer usuario pode criar, editar e deletar templates de eventos**.

A mesma vulnerabilidade existe em `daily_volume_snapshots` (policy SELECT), mas la nao ha grants de escrita.

### CRITICA 2: Fabricacao de Contratos (user_contracts)

A policy `Users can manage own contracts` e FOR ALL com `user_id = auth.uid()` e **sem WITH CHECK**:
- Usuario pode INSERT contratos ficticios (posicoes que nunca comprou)
- Usuario pode UPDATE contratos existentes (alterar quantidade de shares, preco)
- Usuario pode DELETE contratos (apagar posicoes perdedoras)

Grants: INSERT, UPDATE, DELETE todos ativos para `authenticated`.

### CRITICA 3: Fabricacao de Transacoes (transactions)

A policy `Users can insert own transactions` permite INSERT com `auth.uid() = user_id`. Grants de INSERT/UPDATE/DELETE estao ativos. Usuario pode inserir transacoes falsas no historico.

### CRITICA 4: Inseracao de Ledger Entries (ledger_entries)

A policy `Users can insert own ledger entries` com `auth.uid() = user_id` permite qualquer usuario autenticado inserir entradas no ledger. Grants de INSERT ativos. UPDATE/DELETE bloqueados por policy `false` (seguro).

### CRITICA 5: Fee Policy Snapshots abertos (fee_policy_snapshots)

Policy INSERT: `auth.uid() IS NOT NULL` -- qualquer autenticado pode inserir snapshots de fee policy.

### MEDIO: Tabelas admin-only com grants desnecessarios

As seguintes tabelas tem RLS restrito a admin mas grants abertos para `authenticated`:

| Tabela | Grants Ativos |
|---|---|
| achievements | INSERT, UPDATE, DELETE |
| admin_audit_logs | INSERT, UPDATE, DELETE |
| fee_rules | INSERT, UPDATE, DELETE |
| market_options | INSERT, UPDATE, DELETE |
| market_settlements | INSERT, UPDATE, DELETE |
| markets | INSERT, UPDATE, DELETE |
| copy_trade_settings | INSERT, UPDATE, DELETE |
| referral_settings | INSERT, UPDATE, DELETE |

### MEDIO: FeeEngine frontend ainda escreve no banco

O `FeeEngine.ts` ainda possui:
- `recordLedgerEntry()` -- insere em `ledger_entries` (grant ativo + RLS permite)
- `createSnapshot()` -- insere em `fee_policy_snapshots` (grant ativo + RLS permite)
- `recordAuditLog()` -- insere em `admin_audit_logs` (grant ativo, RLS restringe a admin)

## Plano de Correcao

### Migration SQL

**Grupo A -- Revogar grants de tabelas admin-only:**
```text
REVOKE INSERT, UPDATE, DELETE ON 
  achievements, admin_audit_logs, event_templates, fee_rules,
  market_options, market_settlements, markets, copy_trade_settings,
  referral_settings
FROM authenticated;
```

**Grupo B -- Revogar grants de tabelas que so devem receber writes via service_role:**
```text
REVOKE INSERT, UPDATE, DELETE ON 
  transactions, user_contracts, ledger_entries, fee_policy_snapshots
FROM authenticated;
```

**Grupo C -- Corrigir policies que usam raw_user_meta_data:**
```text
DROP 4 policies de event_templates que usam raw_user_meta_data
RECRIAR usando has_role(auth.uid(), 'admin'::app_role)

DROP policy "Admins can read snapshots" de daily_volume_snapshots
(ja existe outra policy correta usando has_role)
```

**Grupo D -- Corrigir policy permissiva de user_contracts:**
```text
DROP policy "Users can manage own contracts" (FOR ALL sem WITH CHECK)
RECRIAR como SELECT-only: "Users can view own contracts" (ja existe)
Manter apenas a policy de admin e service_role para writes
```

### Limpeza do FeeEngine Frontend

Remover os 3 metodos que ainda escrevem no banco:
- `recordLedgerEntry()` -- deletar (ledger entries sao criados via Edge Functions)
- `createSnapshot()` -- deletar (snapshots sao criados via Edge Functions)
- `recordAuditLog()` -- deletar (audit logs sao criados via Edge Functions)

Manter apenas metodos de calculo (read-only): `getActiveRule()`, `calculateFee()`, `calculateTradingFee()`, `calculateTradeFee()`

### Verificar chamadas antes de remover

Buscar todas as referencias a esses metodos no codigo para garantir que nao quebra funcionalidade existente.

## Impacto

- **Zero downtime**: Todas as operacoes criticas (trades, settlements, deposits) ja usam Edge Functions com `service_role`
- **Funcionalidade preservada**: SELECT permanece em todas as tabelas
- **13 tabelas protegidas** nesta migration
- **5 policies corrigidas** (4 event_templates + 1 daily_volume_snapshots)
- **1 policy removida** (user_contracts FOR ALL)

## Secao Tecnica -- Resumo SQL

A migration tera aproximadamente 40 linhas:
1. REVOKE em massa para 13 tabelas
2. DROP + CREATE de 5 policies com `has_role()` em vez de `raw_user_meta_data`
3. DROP da policy permissiva de user_contracts
4. GRANT SELECT explicito onde necessario

