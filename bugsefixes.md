# Bugs e Fixes — Revisão do projeto odds-watch-client

Data: 2026-11-04. Revisão por leitura de código e migrations, sem conexão com o banco remoto.
Estado dos checks: typecheck OK, lint 0 erros / 218 warnings (`any`), build OK, vitest 5 testes passando (3 arquivos). Nenhum teste cobre fluxos de dinheiro.

Antes de agir, confirme em produção (deve retornar `false`):

```sql
select has_function_privilege('anon','public.atomic_deposit_balance(uuid,numeric)','execute');
```

---

## 🔴 Crítico — permite criar saldo ou agir sobre outros usuários

### C1. RPCs de dinheiro chamáveis por qualquer cliente
- Funções: `atomic_deposit_balance`, `atomic_withdraw_balance`, `atomic_execute_trade`, `atomic_execute_sell`, `atomic_execute_multi_*`, `process_market_payouts`, `process_copy_trade_commissions`, `atomic_subscribe_copy_trader`, `process_referral_commission`, `activate_referral_on_deposit`, `increment_trader_followers`, `check_rate_limit`, `cleanup_rate_limits`.
- Arquivos: `20260117084745`, `20260118154724`, `20260129165741`, `20260117092250`, `20260126005957`, `20260130034454`, `20260119030828`, `20260128044328`, `20260331000001`.
- Problema: todas são `SECURITY DEFINER`, aceitam `p_user_id` livre, nenhuma usa `auth.uid()`, e não existe nenhum `REVOKE EXECUTE` nas migrations. O `DROP FUNCTION` em `20260130034454` ainda removeu o `GRANT ... TO service_role` anterior.
- Cenário: `POST /rest/v1/rpc/atomic_deposit_balance` com a anon key e `{meu_id, 1000000}` credita saldo grátis. `atomic_withdraw_balance(vitima, 5000)` debita a vítima. `process_market_payouts(mercado, 'YES')` liquida qualquer mercado com o resultado escolhido. `check_rate_limit` repetido bloqueia uma vítima (DoS).
- Fix: nova migration com `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;` e `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;`. Para RPCs que o cliente precisa chamar, derivar o usuário de `auth.uid()` e remover o parâmetro.

### C2. Valores negativos ou zero não validados nas RPCs
- `atomic_withdraw_balance` (`20260118154724`): `p_amount = -5000` passa em `v_current_balance < p_amount` e credita.
- `atomic_execute_trade` (`20260129165741`): `p_shares < 0` gera custo negativo e credita a carteira; `p_shares = 0` dá divisão por zero; `p_outcome` diferente de `YES` vira `NO`.
- `atomic_deposit_balance`: sem `p_amount > 0`, sem referência de pagamento, sem idempotência.
- `atomic_subscribe_copy_trader`: `p_amount` negativo debita a carteira do trader e credita o atacante; `p_follower_id` livre.
- Fix: `p_amount > 0`, `p_shares > 0`, `p_outcome IN ('YES','NO')`, `p_copy_percentage BETWEEN 1 AND 100`. Adicionar `CHECK (balance_available >= 0)` em `wallets`, `CHECK (shares > 0)` em `user_contracts`, `CHECK (amount > 0)` em `ledger_entries`.

### C3. `process_market_payouts` sem autorização nem estado do mercado
- Arquivo: `20260130034454`.
- Problema: só checa se o mercado existe. Não exige `status='SETTLED'`, não valida `p_winning_outcome`, não trava o mercado.
- Cenário: comprar contratos baratos e chamar a RPC com o resultado favorável.
- Fix: restringir a `service_role`, derivar o vencedor de `markets.result`, `SELECT ... FOR UPDATE` no mercado, exigir status correto.

### C4. `copy-trade-to-followers` sem autenticação
- Arquivo: `supabase/functions/copy-trade-to-followers/index.ts:23-37` (`verify_jwt = false`).
- Problema: `trader_user_id`, `market_id`, `outcome`, `original_amount`, `original_shares` vêm do body sem checar o chamador. `p_max_cost = copyAmount*1.05` também vem do atacante.
- Cenário: qualquer pessoa força todos os seguidores de um trader aprovado a comprar qualquer mercado e valor.
- Fix: exigir `Authorization: Bearer <service_role>` (como `auto-expire-markets:42`), validar payload e recalcular valores a partir de `transactions` pelo `transaction_id`. Validar também `copy_percentage` e `max_trade_amount` em `subscribe-copy-trader`.

### C5. `check-pix-status` credita a cada chamada
- Arquivo: `supabase/functions/check-pix-status/index.ts:107-136`.
- Problema: busca por `stripe_payment_intent_id` cifrado, mas `encryptSensitiveData` usa IV aleatório (`_shared/encryption.ts:20-50`). A busca nunca acha a linha, então cai em `atomic_deposit_balance` em toda chamada. `create-payment-intent:129` grava o PI em texto puro, então o UPDATE também não acha.
- Cenário: PIX de R$100 pago e função chamada N vezes: saldo sobe R$100 × N.
- Fix: buscar pelo ID em texto puro (ou hash determinístico); UPDATE condicional `WHERE status IN (...) RETURNING` e creditar só se afetou 1 linha; idealmente RPC única transacional com UNIQUE em `stripe_payment_intent_id`.

### C6. `confirm-payment` não valida o dono e pode creditar em dobro
- Arquivo: `supabase/functions/confirm-payment/index.ts:56-112`.
- Problemas: não compara `paymentIntent.metadata.user_id` com `user.id`; sem linha em `payments`, "prossegue com crédito" (`:102-105`) e o comentário afirma falsamente que `atomic_deposit_balance` é idempotente; `charge-saved-card:102,123` já credita e grava o PI cifrado, então um `confirm-payment` posterior credita de novo.
- Fix: validar `metadata.user_id` e `metadata.type === 'deposit'`, exigir linha PENDING pré-existente, padronizar o armazenamento do PI (não cifrar campo usado como chave de busca), usar a RPC única de C5.

### C7. `send-notification-email` sem autenticação e com HTML injection
- Arquivo: `supabase/functions/send-notification-email/index.ts:493-560` (`verify_jwt = false`).
- Problema: usa service role e aceita `user_id`, `title`, `message`, `data` do body sem checar o chamador. Templates interpolam `data.admin_notes` e outros campos sem escape (ex.: `:374`).
- Cenário: qualquer pessoa envia e-mail com conteúdo arbitrário, pelo domínio do projeto, para qualquer usuário (phishing).
- Fix: exigir JWT; permitir só admin ou `user_id == auth.uid()`; escapar HTML.

### C8. INSERT livre em `copy_traders` e `copy_subscriptions`
- Arquivo: `20260118180301:198-200` e `:216-218`.
- Problema: `WITH CHECK` valida só `user_id = auth.uid()` / `follower_id = auth.uid()`. Triggers de proteção (`20260219054018`, `20260219060918`) são só `BEFORE UPDATE`, e o grant de INSERT não foi revogado.
- Cenário: o usuário insere a própria linha com `status='APPROVED'` (vira trader aprovado, com `total_followers` e split à escolha) ou `status='ACTIVE'` (assina sem pagar).
- Fix: `WITH CHECK (status='PENDING' AND approved_by IS NULL ...)`, trigger `BEFORE INSERT` forçando defaults, ou `REVOKE INSERT` e criar via RPC/edge.

---

## 🟠 Alto

### A1. Corridas de crédito/estorno duplicado
- `verify-deposit/index.ts:99-169`: lê status, UPDATE incondicional, então credita. Duas chamadas simultâneas creditam duas vezes. O `.single()` (`:103`) falha se o INSERT de `create-deposit:108-125` falhou, e cada chamada recredita. Os três caminhos de confirmação (`verify-deposit`, `confirm-payment`, `check-pix-status`) não compartilham chave de idempotência.
- `process-withdrawal/index.ts:66-166`: UPDATE por `id` sem `.eq("status","PENDING")`; duas chamadas paralelas estornam duas vezes, e o estorno é registrado como DEPOSIT (infla `total_deposited`). Se o estorno falha (`:163`), só é logado e o usuário perde o saldo. A linha 99 passa um builder `.rpc(...)` como valor do update (não funciona), e `atomic_withdraw_balance` já incrementa `total_withdrawn`.
- Fix: UPDATE condicional com `RETURNING`, creditar/estornar só se afetou 1 linha; estorno e mudança de status na mesma transação (RPC). Falhar se o INSERT do pagamento falhar.

### A2. `request-withdrawal` debita antes de gravar
- `supabase/functions/request-withdrawal/index.ts:148-227`: `atomic_withdraw_balance` debita (`:148`); se o INSERT em `payments` falha (`:220`, inclusive 23505), não há estorno.
- Idempotência fraca: hash de 32 bits com janela de 30s (`:16-27`). Limite de 3 saques/hora (`:128-143`) é check-then-act.
- Fix: débito e INSERT na mesma RPC transacional; `Idempotency-Key` do cliente com UNIQUE.

### A3. `adjust-wallet-balance` sem lock
- `supabase/functions/adjust-wallet-balance/index.ts:110-138`: lê saldo, soma e sobrescreve. Trade ou depósito concorrente se perde. Ledger e audit gravados separados, só logam erro (`:169-193`).
- Fix: RPC com `SELECT ... FOR UPDATE`, ledger e audit na mesma transação.

### A4. Saldo pode ficar negativo no trade
- `atomic_execute_trade` compara `balance_available < v_trade_cost` mas debita `cost + fee`; não há `CHECK (balance_available >= 0)`.
- Fix: comparar com `cost + fee` e adicionar o CHECK.

### A5. Sem webhook do Stripe
- A confirmação de pagamento depende do cliente chamar a função. Não há webhook com verificação de assinatura nem `event.id` único.
- Fix: criar webhook que valida a assinatura e usa a RPC única de pagamento.

### A6. Paper trading manipulável
- `20261104001000:39`: policy `FOR ALL` em `polymarket_paper_wallets` permite UPDATE de `balance_usd` (assumindo UPDATE concedido a `authenticated` por privilégios default; confirmar com `\dp`).
- `execute_polymarket_paper_trade` (`:54-77`): `p_price` só validado em `(0,1]`, sem relação com `polymarket_market_cache`, sem checar mercado aberto, sem limite de `p_shares`. Permite gerar USD virtual infinito.
- Fix: policy `FOR SELECT` apenas; `REVOKE INSERT, UPDATE, DELETE ON polymarket_paper_* FROM anon, authenticated`; buscar o preço no cache dentro da função; revogar EXECUTE de PUBLIC/anon.

### A7. `process_copy_trade_commissions` sempre falha com lucro
- `20260119182643:214` insere `ref_type='COPY_COMMISSION'`, fora do CHECK final de `ledger_entries` (`20260119024313`). A transação inteira dá rollback e a comissão nunca é paga.
- Deadlock: buy (`20260129165741`) trava wallet, market, contract; sell (`20260117092250:212-`) trava contract, wallet, market. Padronizar a ordem.
- Fix: incluir o valor no CHECK e uniformizar a ordem dos locks.

### A8. `auto-expire-markets` marca SETTLED mesmo com payout falho
- `supabase/functions/auto-expire-markets/index.ts:270-304`: erro de `process_market_payouts` é ignorado ("continue anyway") e o mercado vai para SETTLED sem retry. `process-settlement-payouts:73-82` também engole o erro e devolve `success: true`.
- Fix: só mudar o status se o payout tiver sucesso; validar `market.status`/`result` na RPC.

### A9. Crons provavelmente nunca autenticam
- `20261103002000:10-23` e `20260127142849:11-35` usam `current_setting('supabase.service_role_key', true)`, que não é um GUC padrão do Supabase hospedado e tende a ser NULL (`'Bearer ' || NULL` = NULL, resposta 401 silenciosa). `sync-polymarket-catalog` exige `Bearer ${POLYMARKET_CRON_SECRET ?? serviceRoleKey}`. O bloco `DO` pula o agendamento sem aviso se `cron`/`net` não existirem. Project ref hardcoded.
- Verificar: `cron.job_run_details` e `net._http_response`.
- Fix: ler o segredo de `vault.decrypted_secrets`, usar o mesmo segredo no cron e na function, falhar alto se as extensões não existirem.

### A10. Cookies de sessão renovados no SSR não chegam ao navegador
- `src/root.tsx:62-78` e route-modules devolvem `data(..., { headers: auth.headers })`, mas nenhuma rota exporta `headers` (`grep` vazio). No RR7 os headers de `data()` só valem para requests `.data`; em request de documento o `Set-Cookie` se perde. O refresh token antigo fica consumido e o usuário é deslogado aleatoriamente.
- Agravante: `root` e loader da rota rodam em paralelo, cada um cria client e chama `getServerAuthState` (`src/integrations/supabase/server.ts:101`), e dois refreshes disputam o mesmo token.
- Fix: exportar `headers` em `root.tsx` e nas rotas mesclando os `Set-Cookie`; ou compartilhar o auth state por request (middleware/context) com uma única verificação.

### A11. Recuperação de senha e confirmação de e-mail quebradas
- `src/pages/AuthPage.tsx:228` usa `redirectTo: .../auth?recovery=true`; o loader `src/route-modules/auth.tsx:19-37` troca o `code` e redireciona para `returnTo`, ignorando `recovery`. Não existe tela de nova senha (`updateUser`/`PASSWORD_RECOVERY` ausentes).
- `src/hooks/AuthSync.tsx:56`: `emailRedirectTo` = `/`, que redireciona para `/markets`; com PKCE o `?code=` se perde.
- Fix: apontar o redirect para `/auth`, tratar `recovery` no loader e criar a tela de reset com `supabase.auth.updateUser`.

### A12. Polling PIX em loop
- `src/components/payments/DepositModal.tsx:100-142`: `checkPixPaymentStatus` tem o objeto do `useMutation` nas deps, que muda a cada render. O effect refaz o "initial check" e recria o `setInterval`, chamando `check-pix-status` continuamente. Confirmar na aba Network.
- Fix: usar `checkPixStatus.mutateAsync` (estável) ou ref; tirar o check inicial do ciclo de deps.

### A13. RPCs de contador abertas
- `20260115180917:103-140`: `increment_comment_likes`, `increment_replies_count` e decrements são `SECURITY DEFINER` sem checar `auth.uid()` (chamadas em `src/services/CommentService.ts:264,338,354,444`).
- Fix: mover para triggers ou RPC com validação.

---

## 🟡 Médio

### M1. Drift de schema e migrations editadas
- `referrals`, `referral_settings` e `referral_commissions` são usadas por funções e pelo código (`link-referral`, `update-referral-settings`, `get-admin-user-details`, `ReferralService.ts`), mas nunca criadas em migration (protegidas só por `to_regclass`).
- `process_market_payouts` final usa `user_contracts.quantity/status/payout/purchase_price`, que nenhuma migration cria (a tabela tem `shares`, `average_price`, `total_invested`). Um banco recriado do zero quebra.
- Cinco migrations já aplicadas foram editadas (diff não commitado): `20260117092250`, `20260127142849`, `20260219060918`, `20260324172745`, `20260324214741`. O Supabase não reaplica migration editada, então o remoto diverge do repo.
- `supabase/config.toml` trocou o `project_id` (`nfwxyftsdhgxfrnrvsdo` → `tztqsorbugjhwljbiano`).
- Fix: reverter as edições e criar migrations novas; gerar baseline com `supabase db dump`.

### M2. Policies e dados expostos
- `payments`: INSERT amplo (`20260115040429:12-37`, `20260324214741:16-23`); usuário escolhe `type`, `net_amount`, `stripe_*`, `metadata`, `idempotency_key`; só há índice não-único em `stripe_checkout_session_id` e nenhum em `stripe_payment_intent_id`. Fix: UNIQUE parcial, `REVOKE INSERT` (criar via edge) ou travar colunas no `WITH CHECK`.
- `support_messages` (`20260118001746:58-68`): `sender_id` e `is_staff` forjáveis. Fix: `AND sender_id = auth.uid() AND (is_staff = false OR has_role(...))`.
- `profiles.cpf/email/phone` fora de `protect_profile_fields` (`20260219054018`).
- `polymarket_market_cache.source_payload` legível por anon (`20261103000000:20`).
- `src/root.tsx:62-73` serializa o `User` inteiro no HTML (inclui `user_metadata` com CPF e telefone, e `identities`). Fix: devolver só `{ id, email }`.
- Trigger de signup (`20260115201613:12-14`) credita R$1000 sem ledger, farmável com várias contas.
- Views `payments_safe` (`20260116171845:6`) e `profiles_public` (`20260325014112`) voltam vazias para usuário comum por causa do RLS da tabela base (leaderboard mostra só o próprio perfil).

### M3. Trade de custo zero e checagens ausentes
- `atomic_execute_trade`: `ROUND(..., 2)` permite custo R$0,00 para `shares × preço < 0,005`; `execute-multi-trade` sem rate limit, sem teto de shares e sem checagem de tipo (`index.ts:76-88`). Fix: custo mínimo por ordem, arredondar para cima, rate limit.
- `execute-trade` e `execute-sell` não checam `is_blocked` (só `execute-multi-trade:49-61`). Fix: checar dentro das RPCs.

### M4. Frontend
- Notificações para terceiros falham em silêncio: `createNotification` (`src/services/NotificationService.ts:~22`) insere no cliente para outro `user_id`, e o RLS (`20260118022900`) só permite o próprio ou admin. Afeta `notifyCommentReply/Mention/Like`.
- `MarketsPage.tsx:95-105`: `setSearchParams` a cada tecla revalida o loader do root (`getUser` + `has_role`) e de `markets`; sem `shouldRevalidate` nem debounce. `usePolymarketMarketStream.ts:31-34` chama `revalidate()` a cada mensagem do WebSocket.
- Cache do servidor sem limite: `PolymarketMarketDataProvider.server.ts:25-26,148,166` (`Map` por `q`, `cursor`, `id` controlados pelo usuário; sem LRU, sem dedupe de requisições em voo). Fix: LRU, dedupe de promessas, rate limit.
- Hydration mismatch: datas Polymarket sem `timeZone` (`PolymarketMarketsPage.tsx:37-39,75`, `PolymarketMarketDetailPage.tsx:27-29`); `localStorage` no initializer de `useState` (`useCardStyle.ts:7-15`, `useFavoriteEvents.ts:6-16`).
- `AuthProvider` não acompanha `initialAuth` após revalidação (`useAuth.tsx:46-52`, `AuthSync.tsx:96-106`); `isAdmin` pode ficar obsoleto até recarregar.
- Chat global (`useGlobalChat.ts:119-124`): `username` vem do cliente (forjável); `loadHistory` (`:44-68`) sobrescreve mensagens recebidas pelo canal.
- Efeitos async sem cancelamento (`MarketsPage.tsx:117-135`).
- Exports CSV/Excel sem neutralizar `=`, `+`, `-`, `@` (`useExport.ts:15-96`). Fix: prefixar com `'`.
- Erros internos devolvidos ao cliente (`error.message` bruto) em `execute-multi-trade:110`, `subscribe-copy-trader`, `create-deposit`, `create-payment-intent`, `confirm-payment`, `verify-deposit`, `request-withdrawal`, `process-withdrawal`.
- Validação fraca de `amount` (`!amount || amount < 10`, sem `typeof number`/`isFinite`) em `create-deposit` (que ainda estoura em `amount.toFixed` na linha 76 após criar a sessão Stripe), `create-payment-intent`, `charge-saved-card`, `request-withdrawal`.
- CORS `*` hardcoded em várias funções em vez de `_shared/cors.ts` com `ALLOWED_ORIGIN`.
- Índices ausentes: `ledger_entries(user_id, created_at)`, `ledger_entries(wallet_id)`, `support_messages(sender_id)`, `copy_trade_commissions(copied_trade_id)`, `transactions(user_id, created_at)`. `ledger_entries` sem UNIQUE `(ref_type, ref_id)` para idempotência.

---

## 🔵 Qualidade e infra

- `tsconfig.app.json` com `strict: false`; 218 warnings de `no-explicit-any` no lint.
- Testes `*.test.ts` das edge functions (Deno) não rodam no CI; vitest cobre só 3 arquivos / 5 testes.
- Três lockfiles versionados (`bun.lock`, `bun.lockb`, `package-lock.json`). Ficar só com o do npm (usado no CI).
- `react-router` e `react-router-dom` coexistem (58 arquivos importam o `-dom`). Redundante no v7.
- `.env` versionado (só chaves públicas `VITE_*`, mas deveria sair): `git rm --cached .env`. `supabase/.temp/` também versionado; mover para o `.gitignore`.
- `.env.local` contém `SUPABASE_SERVICE_ROLE_KEY`. Está ignorado no git, mas não deveria existir num projeto client; manter segredos de servidor fora dele.
- Dependências sem uso: `dompurify` (zero imports) e primitivos shadcn órfãos (`carousel`, `resizable`, `input-otp`, `menubar`, `context-menu`, `navigation-menu`, `aspect-ratio`, `hover-card`, `toggle-group`) com suas deps (`embla-carousel-*`, `react-resizable-panels`, `input-otp`, `@radix-ui/*` correspondentes). `exceljs`, `jspdf`, `html2canvas` estão corretos (import dinâmico).
- `cookie` importado em `src/integrations/supabase/server.ts:4` sem estar no `package.json`.
- Falta `ErrorBoundary` e `HydrateFallback` em `root.tsx`.
- Código morto/ruído: `localStorage.setItem('authReturnTo', ...)` nunca lido (`AuthPage.tsx:182,185`); `globalCardStyle` morto em `useCardStyle.ts:28-36`; `console.log` em produção (`AuthPage.tsx:113`, `useGlobalChat`).
- Resquícios do template Lovable: `name: "vite_react_shadcn_ts"` no `package.json`, `README` genérico com `<YOUR_GIT_URL>`.
- Avisos de future flags do React Router v8 no build.
- Lint: warnings de `any` em várias edge functions (`process-withdrawal`, `request-withdrawal`, `verify-deposit`, `send-notification-email`, `notify-support-reply`).

---

## Verificado sem problema

- `user_roles`: escrita revogada de anon/authenticated (`20260213011315`).
- Policies de `wallets`, `ledger_entries`, `transactions`, `user_contracts`: só SELECT próprio/admin.
- `markets`, `fee_rules`, `platform_revenue`: escrita só admin/service_role.
- `protect_profile_fields` protege `is_blocked` e estatísticas.
- Todas as `SECURITY DEFINER` têm `SET search_path`; colunas monetárias são `numeric`.
- Tabelas Polymarket novas têm RLS; favoritos e `polymarket_market_cache` com escrita só service_role.
- Cliente Supabase do servidor criado por request; `QueryClient` via `useState`; sem `dangerouslySetInnerHTML` em código próprio; preço de compra/venda calculado nas edge functions.

---

## Ordem sugerida de correção

1. **Imediato:** migration com `REVOKE EXECUTE` + `CHECK (balance_available >= 0)` + validações `> 0` (C1, C2, C3, A4); exigir service role em `copy-trade-to-followers` e `send-notification-email` (C4, C7); travar INSERT de `copy_traders`/`copy_subscriptions` (C8).
2. **Pagamentos:** RPC transacional única `complete_payment(payment_id)` com UPDATE condicional e UNIQUE no ID Stripe; corrigir `check-pix-status`, `confirm-payment`, `verify-deposit`, `process-withdrawal`, `request-withdrawal`; criar webhook Stripe (C5, C6, A1, A2, A5).
3. **Auditoria do ledger em produção:** buscar créditos duplicados, depósitos sem pagamento correspondente, saldos negativos ou fora do esperado, assinaturas/traders criados com status privilegiado. Os buracos acima podem já ter sido explorados.
4. Crons com Vault, cookies do SSR, recuperação de senha, polling do PIX, comissão de copy trade (A7, A9–A12).
5. Reverter migrations editadas e criar baseline; ligar `strict` aos poucos; testes de integração para fluxos de dinheiro e Deno tests no CI.
