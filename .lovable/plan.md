

# Restaurar Grants de Admin e Corrigir Vulnerabilidades Restantes

## Diagnostico Real (Dados do Banco)

A analise dos ACLs reais do banco mostra que a situacao NAO e tao grave quanto estimado anteriormente. As tabelas de usuario (comments, profiles, notifications, etc.) ja possuem grants de escrita funcionando. O que esta quebrado sao apenas as **tabelas admin**, que tiveram seus grants revogados impedindo que paginas como AdminFeesPage e AdminMarketEventsPage funcionem.

### Estado Atual dos Grants

**Tabelas com escrita bloqueada (SELECT only para authenticated):**
- fee_rules, markets, event_templates, market_options, market_settlements
- achievements, admin_audit_logs, copy_trade_settings
- wallets, transactions, user_contracts, ledger_entries (service_role only -- correto)
- platform_revenue, copied_trades, etc. (service_role only -- correto)

**Tabelas com escrita aberta (INSERT/UPDATE/DELETE para authenticated):**
- comments, profiles, notifications, payments, etc. -- correto, protegidas por RLS
- **referral_settings** -- VULNERAVEL: grants de escrita abertos, mas deveria ser admin-only

### Vulnerabilidade: referral_settings

A tabela `referral_settings` tem grants INSERT/UPDATE/DELETE abertos para `authenticated`. Embora o RLS tenha uma policy ALL restrita a `has_role(admin)`, a melhor pratica e tambem revogar os grants, mantendo defesa em profundidade.

## Plano de Correcao

### 1. Migration SQL

**Restaurar grants em tabelas admin (8 tabelas):**

Essas tabelas ja possuem policies RLS com `has_role(auth.uid(), 'admin')`. Restaurar os grants permite que as paginas admin funcionem via client-side, pois o RLS garante que apenas admins conseguem escrever.

Tabelas: fee_rules, markets, event_templates, market_options, market_settlements, achievements, admin_audit_logs, copy_trade_settings

**Revogar grants de referral_settings:**

REVOKE INSERT, UPDATE, DELETE para authenticated (defesa em profundidade).

### 2. Limpeza do FinancialRepository

Remover 2 metodos que escrevem em tabelas service_role-only (ja possuem Edge Functions equivalentes):
- `createWallet()` -- nunca chamado no codigo, Edge Function existente
- `adjustWalletBalance()` -- Edge Function `adjust-wallet-balance` ja existe

Manter os metodos de fee rules e settlement, pois com os grants restaurados e RLS admin, continuam funcionando para admins.

## Secao Tecnica

### Migration SQL (~15 linhas)

```text
-- Restaurar grants admin (RLS ja protege com has_role)
GRANT INSERT, UPDATE, DELETE ON fee_rules, markets, event_templates,
  market_options, market_settlements, achievements, copy_trade_settings
  TO authenticated;
GRANT INSERT ON admin_audit_logs TO authenticated;

-- Revogar grants desnecessarios
REVOKE INSERT, UPDATE, DELETE ON referral_settings FROM authenticated;
```

### FinancialRepository.ts

- Remover `createWallet()` (linhas ~222-233)
- Remover `adjustWalletBalance()` (linhas ~235-270)
- Remover import `TablesInsert` se nao usado por outros metodos
- Manter todos os metodos de leitura e os metodos admin (createFeeRule, updateFeeRule, etc.)

### Impacto

- AdminFeesPage volta a funcionar (criar/editar fee rules)
- AdminMarketEventsPage volta a funcionar (liquidar mercados)
- referral_settings protegido por grant + RLS (defesa dupla)
- Zero impacto em funcionalidades de usuario comum

