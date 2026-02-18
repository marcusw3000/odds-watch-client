
# Analise de Vulnerabilidades: Grants Excessivos e Logica no Frontend

## Descoberta Critica: Grants Abertos em TODAS as Tabelas

A mesma vulnerabilidade corrigida em `user_roles` existe em **todas as 43 tabelas** do banco. Todos os roles `anon` e `authenticated` possuem `INSERT`, `UPDATE` e `DELETE` em todas as tabelas. A unica protecao e RLS, que e uma camada unica de defesa -- insuficiente.

## Tabelas de Risco Critico (Financeiro/Integridade)

### Nivel 1 -- Exploraveis AGORA (RLS com brechas)

| Tabela | Vulnerabilidade | Impacto |
|---|---|---|
| `platform_revenue` | INSERT policy: `auth.uid() IS NOT NULL` (qualquer autenticado). UPDATE policy: `auth.uid() IS NOT NULL` | Qualquer usuario pode inserir/alterar receita da plataforma |
| `referral_commissions` | INSERT policy: `auth.uid() IS NOT NULL` | Qualquer usuario pode criar comissoes falsas de indicacao |
| `user_achievements` | INSERT policy: `auth.uid() IS NOT NULL` | Qualquer usuario pode se auto-conceder conquistas |
| `referrals` | UPDATE policy: `auth.uid() IS NOT NULL` | Qualquer usuario pode alterar status de indicacoes |
| `user_contracts` | Policy `Users can manage own contracts` FOR ALL com `user_id = auth.uid()` | Usuario pode fabricar contratos ficticios (posicoes inventadas) |
| `transactions` | INSERT policy: `user_id = auth.uid()` | Usuario pode inserir transacoes falsas no historico |

### Nivel 2 -- Protegidos por RLS mas grants desnecessarios

| Tabela | Risco |
|---|---|
| `wallets` | UPDATE restrito a admin via RLS -- seguro, mas grant deveria ser revogado |
| `markets` | ALL restrito a admin via RLS -- seguro, mas grant deveria ser revogado |
| `market_options` | ALL restrito a admin via RLS -- seguro, mas grant deveria ser revogado |
| `fee_rules` | ALL restrito a admin via RLS -- seguro, mas grant deveria ser revogado |
| `ledger_entries` | UPDATE/DELETE bloqueados por `false` -- seguro, mas grant deveria ser revogado |
| `market_settlements` | ALL restrito a admin -- seguro, mas grant deveria ser revogado |

## Logica de Negocios no Frontend

### 1. FeeEngine (src/services/FeeEngine.ts) -- RISCO MEDIO

O `FeeEngine` no frontend tem metodos que **escrevem** no banco:
- `updateWalletBalance()` -- atualiza wallets (bloqueado por RLS atualmente)
- `recordLedgerEntry()` -- insere ledger entries
- `aggregateRevenue()` -- upsert em platform_revenue (EXPLORAVEL!)
- `processTransaction()` -- orquestra tudo acima

Embora as operacoes criticas (trades) usem Edge Functions, o `FeeEngine` frontend ainda pode ser chamado para manipular `platform_revenue`.

### 2. Validacao de Saldo no Frontend -- SEGURO (redundante)

Os componentes `PurchaseModal`, `MinimalTradingCard` e `TradingModal` validam `userBalance` no frontend. Isso e apenas UX -- o Edge Function `execute-trade` faz a validacao real via `atomic_execute_trade` no PostgreSQL. **Nao e vulnerabilidade.**

### 3. Admin Guard Apenas no Frontend -- RISCO BAIXO

O `AdminLayout` verifica `isAdmin` via `has_role` RPC (SECURITY DEFINER). A verificacao e server-side via RPC, nao localStorage. As Edge Functions admin tambem verificam JWT. **Adequado.**

## Plano de Correcao

### Migration SQL Unica

Revogar grants desnecessarios de todas as tabelas criticas em uma unica migration:

```text
GRUPO 1 -- Tabelas que NAO devem receber writes de anon/authenticated:
  wallets, markets, market_options, fee_rules, market_settlements,
  market_price_history, bcb_data_cache, daily_volume_snapshots,
  copied_trades, copy_trade_commissions, achievements,
  admin_audit_logs, event_templates

  Acao: REVOKE INSERT, UPDATE, DELETE FROM anon, authenticated
  Manter: GRANT SELECT (para RLS de leitura funcionar)

GRUPO 2 -- Tabelas com policies "auth.uid() IS NOT NULL" que precisam correcao:
  platform_revenue:
    - REVOKE INSERT, UPDATE, DELETE FROM anon, authenticated
    (writes feitos apenas via service_role em Edge Functions)

  user_achievements:
    - REVOKE INSERT, UPDATE, DELETE FROM anon, authenticated
    (conquistas concedidas apenas via triggers/service_role)

  referral_commissions:
    - REVOKE INSERT, UPDATE, DELETE FROM anon, authenticated
    (comissoes criadas apenas via service_role)

  referrals (UPDATE):
    - DROP a policy "System can update referrals" com auth.uid() IS NOT NULL
    - Recriar com condicao mais restritiva ou remover UPDATE grant

GRUPO 3 -- Tabelas com INSERT legitimamente necessario para authenticated:
  transactions, user_contracts, payments, comments, comment_likes,
  contestations, copy_subscriptions, ledger_entries, notifications,
  profiles, referrals, support_tickets, support_messages,
  market_suggestions, suggestion_votes, suggestion_comments,
  notification_preferences, user_favorites, audit_logs,
  fee_policy_snapshots, comment_reports, suggestion_comment_likes,
  suggestion_comment_reports, copy_traders

  Acao: Manter INSERT para authenticated (necessario para operacao normal)
  REVOKE INSERT, UPDATE, DELETE FROM anon
  Revisar se UPDATE/DELETE sao necessarios caso a caso
```

### Remover FeeEngine.updateWalletBalance e .aggregateRevenue do Frontend

Esses metodos nao sao chamados diretamente no fluxo atual (trades usam Edge Functions), mas sua existencia e um risco. Devem ser removidos ou marcados como deprecated para evitar uso futuro.

## Secao Tecnica -- SQL da Migration

A migration vai conter aproximadamente:

1. REVOKE em massa para `anon` em todas as tabelas (exceto SELECT)
2. REVOKE seletivo para `authenticated` nas tabelas do Grupo 1 e 2
3. Recriacao de policies com `WITH CHECK` explicito onde ausente
4. GRANT SELECT onde necessario para manter leitura

Estimativa: ~60 linhas SQL, impacto zero em funcionalidade (todos os writes criticos usam `service_role` via Edge Functions).
