# Odds Watch — auditoria para integração Polymarket

Data: 03/11/2026. Base local: commit `76f6183`.

Atualização de implementação: o primeiro incremento de consulta pública foi iniciado neste checkout. As rotas `/polymarket` e `/polymarket/market/:id` consomem o catálogo e a busca pública da Gamma API no servidor, validam e normalizam o payload e o exibem em modo somente leitura. O catálogo usa paginação por cursor; o cache atual é local ao processo, com TTL de 30 segundos. As equivalências USD→BRL usam PTAX de venda do Banco Central, exibem a data de referência e não são saldo nem cotação de execução. A cache persistente, a função de sincronização incremental, a definição do cron de cinco minutos e a tabela isolada de favoritos externos foram adicionadas ao código, mas ainda requerem migration e deploy no Supabase. A interface de favoritos e realtime continuam pendentes.

Plano analisado: `../../ODDS_WATCH_POLYMARKET_IMPLEMENTATION_PLAN.md`, versão 1.0. O plano está fora do repositório Git `odds-watch-client`; deve ganhar uma cópia versionada em `docs/` quando for revisado.

## 1. Parecer

A integração é viável, mas o plano precisa ser adaptado: este projeto já é uma plataforma de mercados com autenticação, backend, carteira contábil, pagamentos, negociação LMSR e liquidação próprias. A integração Polymarket muda o domínio financeiro; não consiste apenas em trocar a URL da fonte de dados.

Recomendação: preservar React Router e Supabase, introduzir um domínio Polymarket separado e entregar primeiro analytics público. Não criar outro backend .NET/Node, banco ou sistema de login apenas porque aparecem como propostas no plano. Um serviço persistente adicional pode ser necessário posteriormente para WebSockets e reconciliação; essa necessidade deve ser demonstrada em uma prova técnica.

Este documento registra análise e propostas, não decisões de produto aprovadas nem integração implementada. Nenhuma migração, operação financeira, implantação ou alteração de configuração remota foi realizada.

## 2. Inventário confirmado no código

| Área | Implementação encontrada | Consequência |
|---|---|---|
| Frontend | React 18, TypeScript, React Router 7 Framework Mode, Vite 7 | Não é apenas uma SPA Vite; existem loaders e SSR |
| Renderização | `react-router.config.ts`: `ssr: true`; `src/entry.server.tsx` | Publicação precisa servir o build de servidor, além dos assets |
| UI e estado | Tailwind, shadcn/Radix, React Query 5, hooks locais, Recharts, Zod | Base visual e ferramentas de validação podem ser reutilizadas |
| Rotas | `src/routes.ts`, `src/route-modules/` | Mercados, detalhes, carteira, perfil, auth e administração já existem |
| Backend | Supabase Auth/PostgreSQL/Realtime e 55 funções com `index.ts` | Há backend próprio; `supabase/functions/_shared` é infraestrutura compartilhada |
| Banco | 134 arquivos em `supabase/migrations/` | Evoluir com migrações aditivas e verificar o schema efetivamente implantado |
| Identidade | `src/hooks/AuthSync.tsx`, `useAuth.tsx`, `src/integrations/supabase/server.ts` | Login por e-mail/senha e validação de sessão já existem |
| Mercados | `src/services/MarketDataProvider.ts` lê `markets` e `market_options` | Provider mistura catálogo, histórico, portfólio, cotações e execução |
| Precificação | `LMSRCalculator.ts`, `LMSRMultiCalculator.ts` | Preço calculado internamente, sem livro CLOB |
| Execução | `execute-trade`, `execute-sell`, `execute-multi-trade` e RPCs SQL | Negociações alteram o sistema financeiro local |
| Carteira | `wallets.balance_available`, `balance_locked`, `currency` | Carteira contábil BRL, não carteira EVM |
| Pagamentos | Stripe, PIX/cartão, depósitos, saques e crédito via RPC | Não constitui on-ramp para uma carteira Polymarket |
| Realtime | `src/hooks/useMarketsRealtime.ts` | Assina alterações Postgres e recalcula LMSR; não recebe preços Polymarket |
| Favoritos | `src/hooks/useFavorites.ts`, tabela `user_favorites` | FK aponta para `markets.id` UUID; IDs externos exigem outro vínculo |
| Observabilidade | Sentry condicional em `src/entry.client.tsx`, ErrorBoundary, `useWebVitals.ts`, logger | Cliente instrumentado quando há DSN em produção; ativação remota e cobertura SSR não confirmadas |

Na auditoria inicial não havia integração Polymarket/Gamma/CLOB, wagmi/viem/WalletConnect, embedded wallet, políticas geográficas ou flags `TRADING_ENABLED`/`FIAT_ENABLED`. A atualização desta entrega adiciona somente o provider público Gamma para a rota `/polymarket`; CLOB, carteiras e trading continuam ausentes.

## 3. Verificações executadas e limites

Ambiente: Windows, Node `v25.8.1`, npm `11.12.0`. Dependências já estavam instaladas; não foi executado `npm ci` nem alterado o lockfile.

| Verificação | Resultado |
|---|---|
| `npm run build` | Passou; gerou `build/client` e `build/server` |
| `npm run lint` | Passou com 210 warnings e zero erros |
| `npx --no-install tsc --noEmit -p tsconfig.app.json` | Falhou com 14 diagnósticos: 11 imports de tipos de rotas e 3 usos de `window.setTimeout` |
| `npm audit --json` | 32 ocorrências: 18 high, 12 moderate, 2 low, zero critical |
| Testes de backend | Nove arquivos `index.test.ts`; Deno e Supabase CLI não encontrados no PATH; não executados |
| Testes de frontend/E2E | `npx --no-install playwright test --list`: nenhum teste encontrado; `e2e/` ausente e sem script `test` |
| CI | Nenhum `.github/workflows` encontrado neste checkout |
| Segredos — triagem limitada | 798 arquivos rastreados/artefatos de `build/client` examinados; sem correspondências dos padrões sensíveis verificados |

Build bem-sucedido não significa typecheck bem-sucedido. Os 14 diagnósticos persistiram após `npx --no-install react-router typegen`. `tsconfig.app.json` não configura o relacionamento com `.react-router/types`; corrigir a configuração e incorporar geração de tipos ao script de verificação. Os três diagnósticos adicionais estão em `src/app/AppProviders.tsx`, `src/components/layout/Header.tsx` e `src/components/layout/Layout.tsx`.

O resultado de `npm audit` é um retrato da base consultada, incluindo dependências transitivas e de desenvolvimento; não demonstra exploração. Há ocorrências em dependências diretas como React Router, Vite, DOMPurify e Zod. Tratar por alcance e compatibilidade, sem aplicar `audit fix --force` indiscriminadamente.

Há três lockfiles (`package-lock.json`, `bun.lock`, `bun.lockb`) e ausência de versão de runtime/gerenciador declarada no `package.json`. Escolher um gerenciador, fixar runtime e confirmar instalação limpa em CI antes de declarar build reproduzível.

### Segurança e testes: o que ainda não foi certificado

- `.env` está rastreado apesar do `.gitignore`; os valores classificados nesse arquivo são públicos, incluindo JWT Supabase com papel `anon`. Isso, isoladamente, não é vazamento de credencial administrativa.
- `.env.local` contém uma credencial `service_role`, não rastreada. A triagem não encontrou seu valor nos arquivos rastreados ou no bundle cliente. Não reproduzir seu valor em logs/documentação.
- `.env.example` está sendo ignorado por `.env.*`; adicionar exceção para versionar o template na implementação.
- A busca usou comparação com valores locais sensíveis, JWTs `service_role` e alguns formatos de segredo. Não substitui scanner completo, revisão de logs, histórico Git, RLS ou auditoria de produção. O histórico tem 1.052 commits em HEAD e não foi varrido integralmente.
- `verify_jwt = false` aparece em várias funções. As funções de compra/venda e pagamentos examinadas fazem validação manual com `auth.getUser`; não inferir acesso anônimo apenas desse parâmetro. Auditar cada nova rota e cada caminho de execução.
- Os testes de `execute-trade` chamam uma URL Supabase configurada e vários casos chamados de validação de entrada esperam `401`, sem chegar à validação. Também enviam `position`, enquanto o handler usa `outcome`. Acrescentar casos autenticados em ambiente isolado e mocks locais.
- Hospedagem, RLS efetivamente aplicada, branch protection, configuração Stripe, verificação de e-mail, métricas ativas e estado financeiro em produção não foram confirmados.

## 4. Ajustes necessários no plano original

### 4.1 Backend e autenticação já existem

As fases 0/2 e tarefas iniciais devem passar de “criar backend/login” para “validar e estender Supabase”. Embedded wallet pode exigir integração com outro provedor de identidade: preservar `auth.users.id` e definir a vinculação antes de introduzir outra sessão de usuário.

### 4.2 Domínio atual não representa Polymarket

`src/types/market.ts` exige `lmsr`, interpreta `Outcome.price` em centavos BRL e define `contractUnitCost` local. Em `MarketDataProvider.ts`, preços são calculados a partir de shares LMSR. `BidAskSpread.tsx` calcula diferenças entre cotações LMSR, não o spread de um livro externo.

Não preencher LMSR artificial para satisfazer interfaces. Criar DTOs próprios, com fonte e versão do protocolo, e adaptar a camada de apresentação. `eventId`, `marketId`, `conditionId` e identificador do outcome são entidades distintas. A documentação consultada diferencia `tokenId` em CTF/v1 e `positionId` em v2; manter IDs grandes como strings e não pressupor `clobTokenIds` presente em todo mercado. Um evento com vários mercados também não equivale automaticamente ao mercado `MULTIPLE` local. [Fonte oficial](https://docs.polymarket.com/market-data/discover-markets).

### 4.3 Documentação vigente altera detalhes de integração

Verificação documental feita em 03/11/2026; APIs/SDKs não foram exercitados ponta a ponta.

| Tema | Constatação | Ajuste no plano |
|---|---|---|
| Brasil | Está listado como **close-only no frontend e API**, sem abertura de novas posições | Modelar `canOpenPosition` e `canClosePosition`; MVP pode manter todo trading desligado. Não habilitar fechamento automaticamente |
| SDK | Documentação orienta `@polymarket/client` unificado | Fazer prova de compatibilidade com runtime e signer e fixar versão; não adotar tutorial antigo como especificação |
| Carteira | Deposit Wallet é o padrão para novas contas; signer e account wallet são distintos | Armazenar ambos os endereços e tipo de carteira; Safe/proxy são casos legados |
| Colateral | Documentação descreve pUSD em Polygon, com seis casas decimais | Distinguir ativo de liquidação, USD de exibição e equivalência BRL |
| Builder | `builderCode` integra a ordem assinada | Atribuição precisa entrar antes da assinatura; distinguir código de atribuição de credenciais secretas |

Fontes correspondentes: [restrições](https://docs.polymarket.com/api-reference/geoblock), [SDK unificado](https://docs.polymarket.com/migrate/clob-sdk-to-unified-sdk), [carteiras](https://docs.polymarket.com/trading/wallets-auth), [pUSD](https://docs.polymarket.com/concepts/pusd), [atribuição de ordens](https://docs.polymarket.com/trading/place-orders).

O endpoint de geoblock avalia o IP de quem faz a requisição. Chamá-lo apenas a partir do servidor não comprova a localização do usuário. A política deve usar contexto de requisição de infraestrutura confiável, verificar as regras do provedor e falhar fechada quando não houver evidência suficiente. A capacidade de fechamento também depende da posição existente e das demais regras aplicáveis, não apenas de país. [Fonte oficial](https://docs.polymarket.com/api-reference/geoblock).

### 4.4 Mocks, falhas e dinheiro

`MarketDataProvider.getEvents()` retorna mercados mock em erro ou banco vazio; `getUserPortfolio()` apresenta dados demonstrativos para usuário sem login; há fluxo `purchaseContractMock`. Na experiência Polymarket, ausência/erro de dado deve produzir estado indisponível ou cache explicitamente desatualizado. Simulações precisam ser identificadas como tal e isoladas de saldo/ordens reais.

Separar `probability`, `price`, `currency`, `collateralAsset`, `sourceUpdatedAt` e `fetchedAt`. Preço ausente não é zero. Decimal financeiro deve viajar como string/unidade inteira com escala definida; porcentagens e arredondamento pertencem à apresentação. `formatCurrency` e `formatVolume` hoje assumem BRL, sem conversão.

### 4.5 Custódia, pagamentos e liquidação

Não reutilizar `wallets` para o schema de carteiras EVM proposto no plano: a tabela já contém saldos e histórico financeiro local. Criar `user_wallet_links` ou equivalente. Não converter saldos existentes em pUSD por migração nem redirecionar depósitos Stripe automaticamente.

O fluxo local `atomic_execute_trade` conclui operações dentro do banco; uma ordem CLOB pode ficar aberta, executar parcialmente e exigir reconciliação. É necessário domínio próprio de ordens/execuções. Liquidação manual/BCB, copy trading, taxas locais e payouts não devem processar mercados externos.

O plano deve acrescentar uma estratégia de transição para usuários, posições, pagamentos pendentes e ledger existentes. Não há evidência nesta análise sobre existência ou volume de posições reais em produção.

### 4.6 Sequência, aceite e estimativas

Antecipar capabilities e flags desligadas para a primeira entrega de dados, evitando que os componentes atuais abram compra/depósito para mercados externos. Antecipar a definição de atribuição Builder para o desenho de ordens, mantendo a candidatura comercial como etapa separada.

Não assumir sandbox público ou fundos de teste disponíveis. Primeiros testes devem usar fixtures/mocks e ambiente Supabase isolado; demonstração com ordens reais exige contexto autorizado confirmado. Custos e prazos do plano permanecem hipóteses até definir escopo de transição, operação SSR, provedores e realtime.

## 5. Reutilizar, adaptar, substituir e criar

| Ação | Componentes/arquivos | Trabalho |
|---|---|---|
| Reutilizar | Layout, shadcn, skeletons, ErrorBoundary, componentes visuais de gráficos | Preservar experiência visual e tratamento básico de carregamento |
| Reutilizar | Supabase Auth, Postgres, React Query, estrutura de funções | Estender os serviços existentes, sem duplicar identidade |
| Adaptar | `src/routes.ts`, loaders de mercados/detalhe, páginas correspondentes | Roteamento por origem e DTOs próprios, sem import de segredo no cliente |
| Adaptar | `MarketCard`, filtros, busca, gráficos e favoritos | Dados externos, paginação real, origem, timestamps e estado indisponível |
| Adaptar | `src/lib/formatters.ts` | Moeda explícita e BRL estimado com fonte/horário |
| Substituir no fluxo Polymarket | `useMarketsRealtime`, `BidAskSpread`, cotações LMSR | Feed e livro externos, sem recalcular preço local |
| Substituir no fluxo Polymarket | Modais de compra/venda, operações de `MarketDataProvider` | Preview, assinatura, submissão e acompanhamento de ordem CLOB |
| Manter isolado | `FinancialRepository`, `wallets`, ledger, Stripe, RPCs LMSR, settlement/copy trading | Preservar histórico e evitar mistura de sistemas financeiros |
| Criar | Provider Polymarket, schemas de resposta, cache e contrato paginado | Catálogo e dados de mercado independentes de trading |
| Criar | Capabilities, vínculos EVM, FX, ordens/execuções/auditoria | Capacidades ausentes hoje |
| Criar | CI, fixtures de API, testes de integração e E2E | Cobertura verificável dos novos fluxos |

`useInfiniteMarkets` apenas fatia o array já carregado. Escalar o catálogo requer paginação na fonte, cursores associados aos filtros e busca no servidor; não basta aumentar o tamanho do array.

## 6. Arquitetura proposta para a primeira entrega

```text
React Router SSR + UI React Query
  -> gateway de dados público (Supabase Edge Functions)
     -> adaptador Gamma/CLOB público + validação de resposta
     -> cache Postgres com fetched_at, source_updated_at, expires_at
  -> Supabase Auth + favoritos por origem/identificador externo
  -> capabilities (trading/fiat desligados)

Domínio LMSR/BRL existente: independente, sem receber IDs Polymarket.
```

Os loaders SSR e o cliente devem usar o mesmo contrato de gateway. Arquivos server-only não podem atravessar imports compartilhados. Para dados públicos iniciais, REST com cache basta para a primeira fatia; realtime é incremento necessário para concluir a fase de dados completa.

Não usar cache em memória de uma Edge Function como única proteção global: instâncias não compartilham estado. Começar com cache persistido e expiração explícita, limites e deduplicação; adotar Redis ou serviço persistente se métricas justificarem. Planejar WebSocket com snapshot inicial, atualização incremental, reconexão, ressincronização e indicador stale, escolhendo canal/versionamento conforme documentação e runtime. [Realtime oficial](https://docs.polymarket.com/market-data/realtime-data).

Contratos de dados sugeridos:

- `GET /api/markets?source=polymarket&cursor=...&query=...`: página, próximo cursor, filtros aplicados e estado de atualização.
- `GET /api/markets/polymarket/:id`: evento/mercado/outcomes e origem, sem obrigação de conter LMSR.
- `GET /api/fx/quote?from=USD&to=BRL`: valor, fonte, horário de referência, coleta e expiração; indisponível explicitamente em falha.
- `GET /api/me/capabilities`: capacidade por ação, razões, versão da política e validade; política anônima definida para leitura pública.

Esses caminhos são contratos lógicos propostos. Edge Functions usam `/functions/v1/...`; implementar mapeamento via rotas resource do React Router ou cliente de funções, documentando uma única convenção.

Estrutura aditiva sugerida, sem reorganização geral:

```text
src/types/polymarket.ts
src/services/PolymarketMarketDataProvider.ts
src/hooks/usePolymarketMarkets.ts
src/hooks/useCapabilities.ts
src/lib/currency/
supabase/functions/polymarket-markets/index.ts
supabase/functions/polymarket-market/index.ts
supabase/functions/fx-quote/index.ts
supabase/functions/user-capabilities/index.ts
supabase/functions/_shared/polymarket/
supabase/migrations/<timestamp>_polymarket_market_data.sql
docs/adr/
```

Banco: catálogo/cache externo separado, unicidade por fonte/versão/identificador; favoritos externos com FK para esse catálogo ou associação validada equivalente. Depois, `user_wallet_links`, `eligibility_checks`, `external_orders`, `external_order_events` e `external_fills`. Usar RLS por usuário e índices/chaves de idempotência explícitos. Não criar outro `users` independente de `auth.users`.

Para ordens, armazenar hash do payload associado à chave de idempotência. Timeout de submissão pode significar resultado desconhecido: reconciliar por identificador/hash antes de reenviar. Eventos recebidos fora de ordem/duplicados e execuções parciais devem ser tratados sem duplicar saldo ou posição. Falha em cache/geolocalização não pode liberar trading.

## 7. Backlog executável

| Ordem | Entrega | Arquivos/áreas | Aceite |
|---|---|---|---|
| P0.1 | Sanear base de desenvolvimento | `package.json`, lockfiles, tsconfigs, entrypoints | Instalação limpa, geração de tipos, lint, typecheck e build em CI |
| P0.2 | Triar dependências e segredos | Dependências, `.gitignore`, template de env, CI | Atualizações compatíveis; scanner de histórico; nenhum segredo no bundle |
| P0.3 | Definir fronteira do produto | ADR de domínio e backend | Decisão explícita sobre coexistência/retirada do LMSR e tratamento do legado |
| P1.1 | Modelo e adaptador de catálogo | Novos tipos, schemas e provider | Fixtures v1/v2, IDs preservados, preço ausente distinto de zero, sem mocks silenciosos |
| P1.2 | Gateway/cache/paginação | Edge Functions + migração aditiva | Timeout, 429, resposta inválida, paginação e cache expirado testados |
| P1.3 | Capabilities e leitura | Nova função/hook; cards/detalhes/header | Mercado externo nunca dispara compra, depósito ou RPC local no modo consulta |
| P1.4 | UI pública | Loaders, páginas, busca, filtros, favoritos | Navegação SSR/client coerente, favoritos por origem, fonte e link externo |
| P1.5 | FX indicativo | Serviço FX e formatadores | Fonte/horário/expiração; moeda USD preservada sem cotação BRL válida |
| P1.6 | Livro, histórico e realtime | Adaptadores e gráficos | Spread real, reconexão/ressincronização, stale visível e limites respeitados |
| P2 | Identidade e carteiras | Auth existente + wallet links | Prova de controle, nonce/replay, rede, signer/account wallet e troca de conta testados |
| P3 | Política e auditoria | Capabilities e controles server-side | Revalidação em cada ação; abertura/fechamento separados; política fechada em falha |
| P4 | Ordens e portfólio externos | Trading adapter + tabelas próprias | Preview, assinatura, Builder antes de assinar, idempotência, fills e reconciliação |
| P5 | Fiat opcional | Integração específica de parceiro | Elegibilidade, contrato compatível, liquidação comprovada e reconciliação |

Primeiro conjunto de alterações recomendado: P0.1/P0.2 e ADR de separação. Em seguida, um incremento vertical P1.1–P1.4 que exiba um catálogo real e detalhes em leitura. FX e realtime completam o marco de analytics; login com carteira e execução ficam fora desse primeiro incremento.

## 8. Decisões ainda abertas

1. **Destino do LMSR:** manter produto misto com origens explícitas ou migrar a experiência principal para Polymarket? A proposta técnica permite coexistência durante a transição.
2. **Hospedagem SSR:** confirmar runtime que executará `build/server`; o `preview` atual serve `build/client` e não documenta um servidor de produção completo.
3. **Embedded wallet:** escolher após prova com Supabase Auth, assinatura e conta Polymarket; fornecedor não escolhido nesta auditoria.
4. **Público e funcionalidades:** analytics pode avançar independentemente do gate de trading; geografia, política de fechamento e fiat precisam de validação própria.
5. **FX:** escolher fonte e política de validade; o `bcb-data-fetcher` atual está ligado ao domínio econômico e não comprova um serviço de câmbio de execução.
6. **Migração operacional:** inventariar saldo, posições e pagamentos existentes antes de planejar descontinuação. Nenhuma inferência sobre produção a partir apenas das migrations.

A Fase 0 está parcialmente atendida por este relatório. Permanecem pendentes instalação limpa/CI, correção do typecheck, scanner completo de histórico, testes locais de backend, confirmação do ambiente implantado e ADRs aceitos. O projeto está apto a avançar no incremento de dados públicos, não a liberar negociação Polymarket com o fluxo financeiro atual.
