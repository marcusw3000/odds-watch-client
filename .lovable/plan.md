
# Vulnerabilidade Critica: Grants Ausentes em Todas as Tabelas

## Problema Descoberto

As migrations anteriores de seguranca **removeram TODOS os grants** (INSERT, UPDATE, DELETE) de `authenticated` em **todas as tabelas**, incluindo tabelas onde usuarios legitimamente precisam escrever. O resultado: **a aplicacao inteira esta quebrada** para qualquer operacao de escrita.

Alem disso, varias tabelas perderam ate o grant de SELECT para `anon` e `authenticated`, quebrando leituras publicas.

## Tabelas Afetadas e Grants Necessarios

### Tabelas que precisam de INSERT para `authenticated`

| Tabela | Justificativa |
|---|---|
| comments | Usuarios criam comentarios |
| comment_likes | Usuarios curtem comentarios |
| comment_reports | Usuarios reportam comentarios |
| contestations | Usuarios contestam resultados |
| copy_subscriptions | Usuarios assinam traders |
| copy_traders | Usuarios se candidatam como traders |
| market_suggestions | Usuarios criam sugestoes |
| notifications | Usuarios/sistema criam notificacoes |
| notification_preferences | Usuarios configuram preferencias |
| profiles | Usuarios criam perfil |
| support_tickets | Usuarios abrem tickets |
| support_messages | Usuarios enviam mensagens |
| suggestion_votes | Usuarios votam em sugestoes |
| suggestion_comments | Usuarios comentam sugestoes |
| suggestion_comment_likes | Usuarios curtem comentarios de sugestoes |
| suggestion_comment_reports | Usuarios reportam comentarios |
| user_favorites | Usuarios favoritam mercados |
| audit_logs | Usuarios registram acoes |
| referrals | Usuarios criam codigos de indicacao |
| payments | Usuarios criam pagamentos |

### Tabelas que precisam de UPDATE para `authenticated`

| Tabela | Justificativa |
|---|---|
| comments | Usuarios editam proprios comentarios |
| copy_subscriptions | Usuarios gerenciam assinaturas |
| copy_traders | Traders atualizam perfil |
| market_suggestions | Usuarios editam sugestoes pendentes |
| notifications | Usuarios marcam como lidas |
| notification_preferences | Usuarios atualizam preferencias |
| profiles | Usuarios editam perfil |
| support_tickets | Usuarios atualizam tickets |
| referrals | Usuarios vinculam indicacoes |

### Tabelas que precisam de DELETE para `authenticated`

| Tabela | Justificativa |
|---|---|
| comments | Usuarios deletam proprios comentarios |
| comment_likes | Usuarios removem curtidas |
| notifications | Usuarios deletam notificacoes |
| market_suggestions | Usuarios deletam sugestoes pendentes |
| user_favorites | Usuarios removem favoritos |
| suggestion_comments | Usuarios deletam comentarios |
| suggestion_comment_likes | Usuarios removem curtidas |

### Tabelas que precisam de SELECT para `anon`

| Tabela | Justificativa |
|---|---|
| markets, market_options, market_settlements | Dados publicos de mercados |
| fee_rules, fee_policy_snapshots | Regras de taxas publicas |
| achievements | Conquistas publicas |
| comments, comment_likes | Comentarios publicos |
| copy_traders, copy_trade_settings | Traders publicos |
| bcb_data_cache, market_price_history | Dados publicos |
| profiles_public | View publica de perfis |

### Tabelas que precisam de SELECT para `authenticated`

Todas as tabelas acima mais: wallets, platform_revenue, daily_volume_snapshots, copied_trades, copy_trade_commissions, ledger_entries, transactions, user_contracts, user_achievements, referrals, referral_commissions, notification_preferences, etc.

### Tabelas que devem permanecer SEM writes para `authenticated` (service_role only)

| Tabela | Motivo |
|---|---|
| wallets | Saldo manipulado via Edge Functions |
| platform_revenue | Receita calculada via Edge Functions |
| market_price_history | Historico inserido via triggers/service_role |
| bcb_data_cache | Cache do BCB via Edge Functions |
| daily_volume_snapshots | Snapshots via Edge Functions |
| copied_trades | Trades copiados via Edge Functions |
| copy_trade_commissions | Comissoes via Edge Functions |
| transactions | Transacoes via Edge Functions |
| user_contracts | Contratos via Edge Functions |
| ledger_entries | Ledger via Edge Functions |
| fee_policy_snapshots | Snapshots via Edge Functions |
| achievements | Gerenciado por admin/service_role |
| admin_audit_logs | Logs de admin via Edge Functions |
| event_templates | Templates gerenciados por admin |
| fee_rules | Regras gerenciadas por admin |
| market_options | Opcoes gerenciadas por admin |
| market_settlements | Liquidacoes via admin/service_role |
| markets | Mercados gerenciados por admin |
| copy_trade_settings | Config gerenciada por admin |
| referral_settings | Config gerenciada por admin |
| user_achievements | Conquistas via triggers/service_role |
| referral_commissions | Comissoes via service_role |
| user_roles | Roles via admin Edge Functions |

## Vulnerabilidade Adicional: FinancialRepository Writes

O `FinancialRepository` ainda possui metodos que tentam escrever diretamente no banco via client-side:

1. **`createFeeRule()`** -- insere em `fee_rules` (chamado por AdminFeesPage)
2. **`updateFeeRule()`** -- atualiza `fee_rules` (chamado por AdminFeesPage)
3. **`deactivateFeeRule()`** -- atualiza `fee_rules` (chamado por AdminFeesPage)
4. **`createWallet()`** -- insere em `wallets` (nao chamado atualmente)
5. **`adjustWalletBalance()`** -- atualiza `wallets` + insere `ledger_entries` (existe Edge Function `adjust-wallet-balance`)
6. **`settleMarket()`** -- atualiza `markets` (chamado por AdminMarketEventsPage)

Com os grants revogados, **todos esses metodos agora falham silenciosamente**. As paginas admin que dependem deles estao quebradas:
- `AdminFeesPage` -- nao consegue criar/editar fee rules
- `AdminMarketEventsPage` -- nao consegue liquidar ou fechar mercados

**Solucao**: Esses metodos precisam ser migrados para Edge Functions com `service_role`, ou os grants de escrita devem ser restaurados para essas tabelas com RLS restrito a admin (que ja existe).

## Plano de Correcao

### Migration SQL -- Restaurar Grants Necessarios

```text
1. GRANT INSERT/UPDATE/DELETE para authenticated em ~20 tabelas de usuario
2. GRANT SELECT para anon em ~15 tabelas publicas
3. GRANT SELECT para authenticated em todas as tabelas necessarias
4. NAO restaurar grants para tabelas service_role-only (~23 tabelas)
```

### Decisao sobre tabelas admin (fee_rules, markets, etc.)

Opcao A (recomendada): Restaurar INSERT/UPDATE/DELETE para `authenticated` nessas tabelas, pois o RLS ja restringe a admin via `has_role()`. Isso permite que as paginas admin continuem funcionando.

Opcao B: Manter grants revogados e migrar toda logica admin para Edge Functions. Mais seguro, porem requer refatoracao significativa.

### Limpeza do FinancialRepository

Independente da opcao:
- Remover `createWallet()` e `adjustWalletBalance()` (Edge Function ja existe)
- Manter ou migrar `createFeeRule/updateFeeRule/settleMarket` dependendo da opcao escolhida

## Secao Tecnica

A migration tera aproximadamente 80 linhas de GRANT statements, organizadas por nivel de acesso:
- SELECT para anon (tabelas publicas)
- SELECT para authenticated (todas as tabelas de leitura)
- INSERT/UPDATE/DELETE para authenticated (tabelas de usuario com RLS)
- INSERT/UPDATE/DELETE para authenticated em tabelas admin (com RLS admin)
