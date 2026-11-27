# Plano de melhorias

## Ramp com Pushin Pay — 25/11/2026


A Pushin Pay é o gateway escolhido para os fluxos PIX. A etapa de conversão entre BRL e cripto fica pendente de definição, conforme a decisão de concentrar esta implementação na Pushin Pay.

**Implementação PIX local:** há interface autenticada, cobrança, envio de saque, saldo real em BRL, histórico, webhook e conciliação. O crédito e a reserva ocorrem de forma idempotente e transacional; o destino de saque é cifrado antes da persistência. O endpoint oficial de criação de saque é `/pix/cashOut`. A rota de consulta `/transfers/{id}` respondeu HTTP 404 e `[]` para um identificador fictício autenticado; ainda é necessário confirmar o formato e os estados de uma transferência real com a Pushin Pay. Os fluxos permanecem desativados por padrão.

**Persistência PIX em preparação:** as migrations e testes SQL passaram em PostgreSQL 17 temporário, incluindo 20 tentativas simultâneas de envio, 20 créditos repetidos e dois saques concorrentes com conexões independentes. A carteira PIX usa centavos de BRL e é separada da carteira pUSD e do simulador. Antes de aplicação remota, revisar identidade e histórico do projeto Supabase.

**Fluxo de entrada:** autenticação → solicitação de depósito vinculada ao usuário → cobrança PIX na Pushin Pay → confirmação por consulta autenticada e conciliação → aquisição e entrega do ativo pelo conversor escolhido → confirmação do destino e da disponibilidade em pUSD → lançamento individual no ledger. A confirmação de pagamento e a conclusão da conversão são eventos distintos.

**Fluxo de saída:** solicitação vinculada ao usuário → reserva atômica do saldo disponível → venda ou conversão pelo provedor escolhido → confirmação do BRL disponível → pagamento PIX pela Pushin Pay → confirmação e conciliação do pagamento → liquidação da reserva. Em caso de resultado desconhecido, consultar e reconciliar antes de reenviar ou liberar valores.

- [ ] Confirmar com a Pushin Pay a elegibilidade do negócio, o modelo de titularidade da conta e das chaves PIX, as tarifas contratadas, prazos e limites. O valor de R$ 0,50 por saque é uma proposta comercial, ainda sem confirmação de acordo.
- [ ] Definir conversor, ativos, rede, custódia, origem e destino dos recursos, política de câmbio e taxas, e verificar a compatibilidade de cada etapa com os provedores.
- [ ] Integrar o sandbox Pushin Pay ao fluxo autenticado com persistência por usuário. Há uma ferramenta local de homologação em `scripts/pushinpay-sandbox.mjs`, que cria e consulta cobranças e registra resultados localmente. Configure `PUSHINPAY_SANDBOX_TOKEN` em `.env.local` e execute `node --env-file=.env.local scripts/pushinpay-sandbox.mjs criar 100`, `listar` ou `consultar <identificador local>`. A ferramenta usa Node com suporte a TypeScript nativo. Ela não credita saldo e não substitui o fluxo de produção. Uma falha durante a criação deixa o resultado desconhecido para conciliação no painel antes de qualquer repetição. Se o processo for interrompido, verifique que não há outra execução antes de remover o arquivo de bloqueio local `pushinpay-sandbox-lock.local`.
- [ ] Persistir solicitações e transições, identificadores externos únicos, valores em unidades inteiras, histórico de eventos e lançamentos imutáveis separados por usuário. Implementar reservas e liquidação em transações atômicas.
- [ ] Implementar endpoints autenticados de criação e consulta com verificação de titularidade, idempotência, limites e tratamento de respostas incertas. Confirmar o contrato de idempotência da Pushin Pay antes de qualquer repetição.
- [ ] Receber notificações de pagamento, consultar a transação na Pushin Pay pelo servidor e conferir identificador, valor e estado antes de qualquer lançamento. Tratar notificações repetidas e ausentes por conciliação periódica.

  A rota local `/api/webhooks/pushinpay` autentica o cabeçalho `x-pushinpay-token` e enfileira o identificador. A rota interna `/api/internal/pushinpay-reconcile` processa uma notificação por execução e recupera cobranças sem aviso. A migration `20261125211000_pushinpay_reconcile_schedule.sql` prepara o agendamento mediante Vault e extensões. Ainda falta aplicar as migrations no projeto correto, configurar os segredos na Vercel e no painel da Pushin Pay. Um pagamento confirmado por consulta autenticada credita o saldo BRL uma única vez.

  Cobranças expiradas são exibidas como expiradas e podem ser consultadas novamente pelo usuário; uma confirmação posterior de pagamento gera crédito idempotente. Caso a criação retorne resultado desconhecido sem identificador externo, é necessária uma forma comprovada de localizar e vincular a operação antes de reenviar ou liberar valores. Confirmar também os eventos e o procedimento para estorno ou devolução após um pagamento já creditado.

  O pg_net armazena temporariamente cabeçalhos HTTP na fila do banco. Antes de configurar o segredo do agendamento, verificar no projeto quais papéis conseguem ler a fila e proteger a credencial de conciliação. Referência: https://supabase.com/kb/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357

- [ ] Concluir a validação do fluxo de depósito antes de habilitá-lo. O crédito em BRL ocorre na mesma transação que registra o status confirmado, inclusive para depósitos anteriormente confirmados. Falta testar a integração com a Pushin Pay e configurar as variáveis do servidor. `PUSHINPAY_DEPOSITS_ENABLED` permanece desativado.
- [ ] Implementar integração de conversão com confirmação de valores, taxas, rede, destino, entrega e disponibilização efetiva. Registrar estados pendentes e erros recuperáveis.
- [ ] Validar o saque PIX com a Pushin Pay, inclusive titularidade, formato da consulta, estados, taxas e falhas. O fluxo local reserva saldo e cifra o destino, registra resultado incerto e concilia pagamento ou cancelamento sem duplicar lançamentos. `PUSHINPAY_WITHDRAWALS_ENABLED` permanece desativado.
- [ ] Criar interface para cotação, taxas, confirmação, histórico e estados de depósito e saque, com saldos reais separados do simulador.
- [ ] Validar sandbox de ponta a ponta, incluindo pagamentos duplicados, notificações fora de ordem, falhas parciais, concorrência e recuperação. Conciliar saldos de usuários, reservas e ativos da empresa antes de ativar produção.
- [ ] Verificar elegibilidade e restrições atuais para a Polymarket e obter confirmações dos provedores antes de habilitar operações reais.

Referências: https://app.theneo.io/pushinpay/pix/criar-pix e https://app.theneo.io/pushinpay/pix/consultar-pix

Este documento reúne as melhorias propostas após os testes do site. A ordem prioriza confiabilidade dos dados e conclusão do simulador antes de novas funcionalidades.

## Ordem recomendada

### 1. Sincronização otimizada do catálogo Polymarket

- [ ] Medir espaço disponível, crescimento das tabelas, índices e arquivos de operação do banco.
- [ ] Revisar e validar a sincronização compacta e incremental, sem guardar cópias brutas desnecessárias.
- [ ] Definir limites de armazenamento, retenção e frequência, com processamento em lotes.
- [ ] Testar em ambiente isolado a importação, a atualização, a recuperação após falha e a preservação de favoritos e posições.
- [ ] Publicar a versão validada e reativar a sincronização gradualmente, acompanhando espaço, duração e erros.
- [ ] Confirmar cobertura, paginação, categorias, pesquisa e atualização dos mercados.

**Prós:** catálogo, buscas, categorias e favoritos mais atualizados; menos divergências entre telas.

**Contras:** exige processamento e chamadas à API; uma configuração inadequada pode voltar a consumir o armazenamento disponível.

**Cuidado:** o cron completo estava pausado na última verificação. Não reativá-lo antes de confirmar espaço e validar a versão compacta. O tamanho das tabelas não representa todo o uso de disco, que também inclui WAL e outros arquivos.

### 2. Transparência e atualização dos preços

- [x] Identificar a origem e o horário das cotações exibidas em cards, destaques, detalhes e portfólio, informando quando o horário individual não estiver disponível.
- [x] Diferenciar visualmente dados ao vivo, dados em cache e dados desatualizados.
- [x] Tratar ausência de cotação sem apresentar valores inexistentes como zero. Validado com dados simulados no catálogo, no mercado e no portfólio; zero confirmado continua válido.
- [x] Garantir que favoritos exibam nome e informações úteis mesmo quando o mercado não estiver na cache consultada. Se a consulta pública falhar, mostrar o identificador e informar a indisponibilidade.
- [x] Testar divergências temporárias entre telas, falha da API e reconexão com dados simulados.

**Prós:** o usuário entende a origem dos valores e percebe quando uma informação pode estar desatualizada.

**Contras:** adiciona elementos à interface e não elimina a defasagem enquanto a sincronização estiver pausada.

### 3. Monitoramento e alertas

- [ ] Acompanhar espaço do banco e do disco, crescimento da cache e estado dos agendamentos.
- [ ] Monitorar falhas da Gamma, idade da cache e duração dos ciclos de sincronização.
- [ ] Monitorar filas, atrasos e falhas de processamento do Copy Trading e do histórico de portfólio.
- [x] Definir limites, destinatários e canais de alerta, evitando notificações repetitivas: notificações internas para administradores, com repetição limitada.
- [x] Exibir no painel administrativo o estado dos serviços e a última execução bem-sucedida.
- [x] Testar alertas em banco isolado e registrar procedimentos de recuperação em `docs/monitoramento-operacional.md`.

**Prós:** problemas podem ser identificados antes de afetar muitos usuários.

**Contras:** exige configuração e manutenção; limites inadequados podem gerar alertas excessivos.

### 4. Resolução e resgate automático de posições

**Decisão:** priorizar o resgate automático das posições reais pela carteira integrada. A automação depende de suporte e autorização adequados do provedor de carteira; a mecânica, os limites e os custos ainda precisam ser definidos. Manter negociação real desativada até os pré-requisitos serem validados.

#### Posições reais Polymarket

- [ ] Distinguir fechamento, contestação e resolução definitiva; consultar estado oficial e identificar o protocolo e a posição corretos antes de propor resgate.
- [ ] Selecionar provedor de carteira integrada que suporte autorização e execução automática de resgates, com limites, revogação, recuperação e política de gás definidos.
- [ ] Detectar posições elegíveis e consultar saldo e pagamento aplicável, incluindo resultados fracionados e mercados excepcionais, sem presumir sempre US$ 1 ou US$ 0.
- [ ] Executar o resgate pelo fluxo e contrato corretos para cada protocolo, registrando intenção, autorização, transação e estados de modo idempotente.
- [ ] Conciliar confirmações, reorganizações, transações pendentes, falhas e resgates externos; atualizar saldo pUSD e posições somente após confirmação confiável.
- [ ] Exibir status, custos e histórico ao usuário; monitorar filas e falhas e oferecer recuperação sem duplicar transações.
- [ ] Testar com mocks, concorrência, repetição, recuperação e ambiente autorizado antes de liberar a funcionalidade real.

#### Posições simuladas

- [ ] Definir como identificar resolução definitiva, cancelamento, contestação e alterações posteriores da fonte.
- [ ] Implementar liquidação idempotente das posições simuladas, com registro auditável.
- [ ] Atualizar saldo virtual, posições, histórico, estatísticas e ranking de forma consistente.
- [ ] Definir e informar ao usuário o tratamento de mercados cancelados e resultados excepcionais.
- [ ] Testar vencedores, perdedores, cancelamento, reprocessamento e falhas parciais.

**Prós:** posições encerradas passam a refletir seu resultado final e o simulador fica mais completo.

**Contras:** regras de resolução exigem cuidado, principalmente em mercados contestados ou cancelados.

### 5. Transparência e controles do Copy Trading

- [ ] Mostrar o estado de cada sinal, sua origem, horário, atraso e motivo de rejeição ou expiração.
- [ ] Comparar preço de origem e preço executado e explicar limites de valor e diferença de preço.
- [ ] Apresentar compras, vendas proporcionais, posições vinculadas e lucro realizado por estratégia.
- [ ] Melhorar o fluxo de aprovação manual, pausa, retomada e edição de limites.
- [ ] Testar processamento duplicado, saldo insuficiente, dados externos incompletos e indisponibilidade da API.

**Prós:** torna mais fácil entender o que foi copiado e por que uma operação não ocorreu.

**Contras:** aumenta a complexidade da interface; a atividade pública pode não fornecer dados suficientes para reconstruir todas as vendas externas.

### 6. Testes automatizados e integração contínua

- [ ] Ampliar o workflow existente `.github/workflows/quality.yml`, que já executa lint, typecheck, testes unitários, build, teste SSR e E2E, para incluir testes das funções, integrações isoladas e varreduras de dependências e segredos.
- [ ] Executar testes de banco e RLS em Supabase isolado, incluindo acessos entre usuários.
- [ ] Cobrir login, favoritos, compra, venda, reset, resolução, ranking, Copy Trading e portfólio.
- [ ] Testar concorrência, idempotência, indisponibilidade externa, dispositivos móveis e acessibilidade.
- [ ] Documentar os testes dependentes de dados públicos e diferenciar esses testes dos determinísticos.

**Prós:** reduz regressões e aumenta a confiança antes de publicar alterações.

**Contras:** exige manter testes e infraestrutura e pode aumentar o tempo de verificação.

## Monitoramento de erros com Sentry

**Estado atual:** `@sentry/react` já está instalado. A inicialização do navegador em `src/entry.client.tsx` ocorre somente em produção quando `VITE_SENTRY_DSN` está configurado; há captura no `ErrorBoundary` global. O código também configura rastreamento e Session Replay com texto mascarado e mídia bloqueada. Isso não comprova que o serviço esteja configurado ou recebendo eventos em produção.

### Configuração e cobertura

- [ ] Verificar se já existe projeto Sentry e se o DSN está configurado no ambiente de implantação, sem expor credenciais nos logs.
- [ ] Criar ou reutilizar projetos e ambientes separados para desenvolvimento, homologação e produção; identificar release e versão do deploy em cada evento.
- [ ] Configurar `VITE_SENTRY_DSN` no ambiente correto. O DSN do navegador é público por natureza; tokens administrativos e de upload devem permanecer em segredos do servidor/CI, sem prefixo `VITE_`.
- [ ] Revisar a inicialização assíncrona para garantir captura confiável de erros ocorridos no início da aplicação e evitar registros duplicados.
- [ ] Verificar captura no `ErrorBoundary` global, fronteiras de rota, falhas do servidor e Edge Functions; adicionar instrumentação apenas onde houver lacunas.
- [ ] Adicionar contexto mínimo para diagnosticar falhas de catálogo, favoritos, login, portfólio, paper trading, Copy Trading e integrações futuras, preservando a origem e o identificador de correlação quando disponíveis.
- [ ] Configurar upload seguro de source maps por release no CI e confirmar rastros legíveis; evitar publicar mapas indevidamente e manter o token de upload fora do bundle.

### Privacidade, volume e alertas

- [ ] Revisar e filtrar eventos, breadcrumbs, URLs, cabeçalhos e corpos de requisição para não enviar senhas, tokens, chaves, dados bancários, documentos pessoais ou informações financeiras desnecessárias.
- [ ] Avaliar necessidade, consentimento aplicável e configuração do Session Replay; confirmar mascaramento de campos sensíveis e decidir amostragem e retenção antes de ativá-lo.
- [ ] Revisar as taxas atuais de amostragem de desempenho e replay, filtros de erro e orçamento do plano; não ignorar falhas relevantes de carregamento ou navegação sem evidência.
- [ ] Configurar alertas para erros novos, aumento de falhas e problemas críticos, com responsáveis e limites que evitem notificações excessivas.
- [ ] Acompanhar latência e falhas por ambiente e release; complementar com monitoramento específico de cron, cache e banco, pois o Sentry não substitui esses controles.

### Testes e implantação

- [ ] Em ambiente de testes, gerar um erro controlado e verificar chegada ao projeto correto, release, rota, stack legível e ausência de dados sensíveis.
- [ ] Testar falhas de navegador, rotas, backend e funções instrumentadas, evitando capturas duplicadas e erros esperados tratados como incidentes.
- [ ] Verificar comportamento quando o Sentry estiver indisponível: a aplicação deve continuar funcionando.
- [ ] Liberar gradualmente, acompanhar volume e custos e documentar como desativar a integração e como responder aos alertas.

**Prós:** facilita encontrar e reproduzir falhas em produção e relacioná-las a uma versão do site.

**Contras:** adiciona envio de telemetria, configuração e possível custo; coleta e replay exigem revisão de privacidade.

**Aceite:** erro controlado recebido com contexto útil e sem dados sensíveis, alertas testados, custos monitorados e operação normal com o serviço indisponível.

## Cache compartilhada com Redis

**Prioridade:** avaliar depois de medir as consultas e encaminhar a sincronização do catálogo. O Redis é uma otimização opcional; não corrige dados desatualizados nem reduz, por si só, as gravações do cron no PostgreSQL.

### Arquitetura proposta

```text
Navegador → aplicação → Redis (cache pública compartilhada)
                           ↓ cache ausente ou indisponível
                    Supabase / APIs Polymarket
```

- [ ] Manter o PostgreSQL como fonte persistente de catálogo, usuários, favoritos, carteiras, operações, posições e histórico; não tratar Redis como saldo ou registro financeiro autoritativo.
- [ ] Mapear e medir as caches existentes: React Query no navegador e cache por processo no servidor. Considerar instâncias independentes e reinícios em ambiente serverless.
- [ ] Escolher serviço Redis compatível com a hospedagem, região próxima às funções e Supabase, limites, faturamento, segurança e orçamento. Não assumir que estará na mesma memória do banco.
- [ ] Manter credenciais apenas no servidor/gerenciador de segredos, separadas por ambiente; não expor chaves ao navegador nem registrar dados sensíveis nos logs.
- [ ] Criar adaptador de cache com timeout curto, limites de tamanho, serialização validada, métricas e comportamento configurável por ambiente.

### Piloto: catálogo público

- [ ] Selecionar uma rota de catálogo com tráfego repetido e registrar latência, consultas ao Supabase, erros e custos antes da mudança.
- [ ] Criar chaves versionadas com todos os filtros, paginação e parâmetros que alterem a resposta. Restringir o piloto a dados públicos para evitar vazamento entre usuários.
- [ ] Definir TTL curto para catálogo e detalhes, considerando a idade dos dados de origem. Escolher os valores após medição; não apresentar cache antiga como preço ao vivo.
- [ ] Usar estratégia cache-aside: consultar Redis; em ausência, consultar a fonte, armazenar resultado válido e responder. Evitar armazenar erros ou valores ausentes como preço zero.
- [ ] Proteger contra várias requisições simultâneas reconstruírem a mesma entrada, com mecanismo limitado no tempo e sem bloquear indefinidamente a fonte.
- [ ] Definir invalidação ou versionamento após sincronização, levando em conta que lotes podem terminar parcialmente e que a cache original pode já estar desatualizada.
- [ ] Testar indisponibilidade do Redis: aplicar timeout e retornar à fonte habitual sem derrubar a página. Verificar limites para não sobrecarregar Supabase ou Gamma durante a falha.
- [ ] Definir limite de memória e política de remoção de entradas; monitorar ocupação, remoções e entradas expiradas.

### Medição e expansão

- [ ] Comparar antes e depois: latência p50/p95, taxa de acerto, leituras no Supabase, chamadas às APIs, erros, uso de memória e custo. Testar também cache fria e indisponibilidade do Redis.
- [ ] Expandir apenas se houver benefício mensurável para categorias, detalhes, ranking público ou outras consultas repetidas, definindo TTL e origem para cada dado.
- [ ] Avaliar controle de taxa distribuído em etapa separada, com escopo, expiração e política de falha próprios; não depender do Redis para autorização ou elegibilidade.
- [ ] Revisar qualquer cache futura de dados privados quanto a isolamento por usuário, invalidação e segurança antes de implementá-la.
- [ ] Documentar procedimento de desligamento e retorno à configuração anterior sem perda de dados persistentes.

**Prós:** pode reduzir leituras repetidas e compartilhar respostas entre instâncias, com potencial melhora de latência.

**Contras:** adiciona serviço, custo e pontos de falha; dados podem ficar temporariamente desatualizados e o ganho depende do tráfego e da localização dos serviços.

**Aceite do piloto:** resultados corretos e isolados, fallback comprovado e melhoria mensurável que justifique custo e complexidade. O teste não autoriza reativar o cron completo do catálogo.

## Rate limit e proteção contra abuso

**Prioridade:** proteger primeiro os endpoints ativos com escrita e as consultas públicas de maior custo. Definir limites após medir o uso normal; não limitar atualizações internas da interface como se fossem requisições ao servidor.

### Inventário e política

- [ ] Inventariar rotas da aplicação, Edge Functions e RPCs expostas, seus chamadores, autenticação, custo e limites já existentes. Confirmar quais mecanismos estão realmente publicados antes de alterá-los.
- [ ] Definir limites independentes por operação para consultas públicas, autenticação, favoritos, comentários, paper trading, copy trading, exportação e rotinas administrativas. Considerar também o limite das APIs externas.
- [ ] Identificar usuários autenticados pelo identificador validado no servidor; para acesso anônimo, usar IP apenas quando fornecido por proxy confiável. Evitar confiar em cabeçalhos arbitrários e considerar usuários que compartilham IP.
- [ ] Definir janelas, limites de rajada, exceções internas autenticadas e custos diferentes para operações caras, ajustando-os com base nas métricas. Não registrar segredos nem dados pessoais desnecessários nas chaves ou logs.

### Implementação

- [ ] Aplicar a verificação no servidor antes do trabalho custoso ou da gravação, com contagem atômica compartilhada entre instâncias. Reutilizar a função de banco existente apenas após revisar permissões, concorrência, limpeza e custo.
- [ ] Comparar PostgreSQL com Redis ou serviço equivalente para os endpoints de maior tráfego. Medir escritas e consumo antes de ampliar o uso no banco; usar TTL e limitar a retenção dos contadores.
- [ ] Garantir que chamadas de cron e serviços internos tenham autenticação própria e política adequada; rate limit não substitui autenticação, autorização, validação ou idempotência.
- [ ] Definir comportamento na falha do armazenamento por rota: operações sensíveis devem falhar de forma segura; consultas públicas podem ter fallback restrito e monitorado quando apropriado.
- [ ] Retornar HTTP 429 e `Retry-After` quando aplicável; apresentar mensagem clara e permitir nova tentativa sem repetição automática excessiva. Respeitar os limites e respostas 429 das APIs externas com backoff e jitter.
- [ ] Evitar exposição pública dos contadores e proteger credenciais do armazenamento no servidor. Documentar configuração, implantação, revisão e reversão por ambiente.

### Testes e acompanhamento

- [ ] Testar abaixo e acima do limite, expiração da janela, concorrência entre instâncias, isolamento entre usuários e IPs, múltiplas ações, proxy confiável e recuperação após falhas.
- [ ] Verificar que ações sensíveis não são executadas quando bloqueadas, que repetições idempotentes mantêm seu comportamento e que cron e tráfego legítimo não são bloqueados indevidamente.
- [ ] Medir requisições permitidas e bloqueadas, latência, erros, escritas no banco, consumo e custos; configurar alertas agregados sem dados sensíveis e ajustar limites progressivamente.

**Aceite:** proteção distribuída e testada nos endpoints priorizados, com resposta clara ao usuário, política de falha documentada e consumo compatível com a capacidade disponível.

## Evoluções de produto

### 7. Tradução dos mercados

- [ ] Escolher provedor, orçamento e política de cache de traduções.
- [ ] Traduzir títulos, categorias e descrições no servidor, mantendo o texto original acessível.
- [ ] Evitar traduzir incorretamente nomes próprios e termos importantes das regras.
- [ ] Tratar falhas e permitir visualizar o conteúdo original.

**Prós:** facilita a navegação em português sem depender da tradução automática do navegador.

**Contras:** pode gerar custo por uso e erros de tradução; regras de mercados exigem atenção especial.

### 8. Portfólio mais analítico

- [x] Apresentar claramente resultado realizado e em aberto, valor atual e custo das posições.
- [ ] Aprimorar gráficos por período e detalhamento por mercado, respeitando as amostras disponíveis.
- [x] Informar que o histórico persistente começa com a coleta e não é retroativo.
- [ ] Testar cálculos, períodos sem amostras e cotações ausentes.

**Prós:** ajuda o usuário a entender o desempenho das suas decisões.

**Contras:** aumenta a complexidade dos cálculos e não permite reconstruir automaticamente um histórico que não foi coletado.

### 9. Filtros e descoberta

- [ ] Melhorar pesquisa e filtros por tema, liquidez, vencimento, status e mercados relacionados ao Brasil.
- [ ] Garantir paginação e filtros sobre dados persistidos, com indicação de cobertura e atualização.
- [ ] Testar resultados vazios, combinações de filtros e consultas em dispositivos móveis.

**Prós:** ajuda a encontrar mercados relevantes com menos esforço.

**Contras:** a qualidade dos resultados depende da cobertura e da atualização do catálogo.

### 10. Alertas personalizados

- [ ] Permitir configurar alertas de preço, fechamento e atividade de traders copiados.
- [ ] Adicionar preferências, limites de frequência e cancelamento de alertas.
- [ ] Testar duplicidade, atraso e tratamento de mercados encerrados.

**Prós:** facilita acompanhar mudanças sem manter o site aberto.

**Contras:** aumenta processamento e pode gerar excesso de notificações sem bons controles.

### 11. Simulação mais realista

- [ ] Avaliar execução parcial, liquidez disponível, variação de preço e apresentação de custos simulados.
- [ ] Definir regras de execução e informar os critérios antes da confirmação.
- [ ] Testar livros com pouca liquidez, mudanças de preço e ordens parcialmente executadas.

**Prós:** aproxima a experiência das condições observadas no livro de ofertas.

**Contras:** pode tornar a compra mais lenta e complexa; a simulação continua diferente de uma negociação real.

## Fora desta fase

As etapas abaixo pertencem ao plano original e não são necessárias para concluir o simulador. Não representam autorização para habilitar operações reais.

### Identidade e carteiras para negociação real

- [ ] Iniciar com **carteira integrada**, conforme escolha do usuário. Comparar provedores por compatibilidade Polymarket/Polygon, custos, segurança, recuperação e portabilidade antes de selecionar um.
- [ ] Registrar as decisões de arquitetura em ADRs e comparar carteira externa e integrada quanto a custo, recuperação, segurança, rede e compatibilidade com a Polymarket.
- [ ] Definir verificação de e-mail, recuperação de conta e MFA/passkey conforme os requisitos escolhidos.
- [ ] Se aprovada a carteira integrada, selecionar provedor e criar vínculo individual sem armazenar chaves privadas no servidor.
- [ ] Se aprovada a carteira externa, vincular e desvincular endereços mediante prova de posse com nonce, domínio, rede e expiração; tratar troca de carteira e rede.

### Elegibilidade, segurança e negociação real

- [ ] Confirmar documentação, restrições geográficas e condições comerciais vigentes antes de qualquer lançamento; não contornar bloqueios.
- [ ] Definir política server-side de elegibilidade por ação, incluindo região e demais verificações aplicáveis. As capabilities atuais estão intencionalmente fechadas para operações reais.
- [ ] Definir e testar flags de trading e fiat desativadas por padrão, sem depender de controles apenas no frontend.
- [ ] Fazer modelagem de ameaças, revisão de permissões, limites de acesso, resposta a incidentes e auditoria de eventos sem expor dados sensíveis.
- [ ] Revisar histórico Git, logs e bundles em busca de segredos e revogar ou rotacionar eventuais credenciais expostas.
- [ ] Validar SDK, autenticação, garantias, contratos e Builder Code vigentes; implementar adaptador CLOB separado do paper trading.
- [ ] Implementar prévia, assinatura autorizada, envio idempotente, estados e cancelamento de ordens; reconciliar posições e execuções com a fonte oficial.
- [ ] Testar bloqueios, autorizações, assinatura, replay, execução parcial, saldo e liquidez insuficientes, falhas e reconciliação em ambiente autorizado.
- [ ] Concluir análise jurídica e comercial antes de oferecer negociação real.

### Fiat e PIX

- [ ] Confirmar com a Pods quais operações de ramp estão habilitadas para a credencial de staging e validar seus contratos antes de implementar o fluxo financeiro de teste.
- [ ] Separar os estados de cotação PIX, pagamento, entrega de USDC, conversão na Bridge e crédito de pUSD; só oferecer confirmação da ordem após o crédito confirmado.
- [ ] Avaliar parceiro autorizado e compatível com BRL/PIX, carteiras individuais e a finalidade pretendida.
- [ ] Implementar cotação com validade, tarifas e prazos claros; separar equivalência estimada de saldo efetivamente liquidado.
- [ ] Validar webhooks assinados, proteção contra replay, idempotência, estados de transferência e reconciliação.
- [ ] Bloquear entrada e saída onde o parceiro ou a política aplicável não permitirem a operação.

### Builder e lançamento

- [ ] Revisar requisitos oficiais atuais e configurar credenciais apenas em gerenciador de segredos.
- [ ] Implementar e testar atribuição Builder no fluxo autorizado antes da assinatura, conforme a versão vigente da integração.
- [ ] Preparar documentação, demonstração e eventual candidatura; não anunciar parceria oficial sem confirmação e autorização.
- [ ] Definir ambientes de desenvolvimento, homologação e produção, com critérios explícitos de liberação e observabilidade.
- [ ] Manter operações reais separadas do Paper Trading, sem converter saldos, posições, Copy Trading ou comissões simuladas em ativos reais.
- [ ] Cobrir ordens reais com confirmação explícita, idempotência, execução parcial, cancelamento e reconciliação; tratar timeouts sem presumir execução ou rejeição.
- [ ] Realizar testes com valores reais somente em contexto elegível e autorizado, com limite definido e procedimentos de recuperação.

## Referências

- [Documentação de tamanho do banco e uso de disco do Supabase](https://supabase.com/docs/guides/platform/database-size).
- [Manutenção da cache Polymarket](docs/manutencao-cache-polymarket.md).
- [Copy Trading e histórico do simulador](docs/paper-copy-and-history.md).
