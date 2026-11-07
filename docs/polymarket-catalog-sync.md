# Sincronização do catálogo Polymarket

Eventos e mercados são armazenados em cache própria, separados das carteiras e dos mercados locais. A lista pública consulta eventos persistidos com paginação e filtros; quando o esquema ainda não estiver disponível, a primeira página simples pode usar uma amostra da Gamma, identificada na interface.

O sincronizador processa várias páginas por execução dentro de um orçamento de tempo. Um lease impede execuções simultâneas, e cada página de mercados é confirmada junto com seu cursor. Páginas grandes de eventos são retomadas por lotes de IDs persistidos; o cursor só avança após todos os lotes serem confirmados. Mercados omitidos pela listagem em lote são consultados individualmente antes de avançar. Os eventos de maior volume são atualizados prioritariamente. Uma rotina separada consulta o status explicitamente, incluindo mercados encerrados; resultados ausentes ou erros não são interpretados como encerramento.

Os preços exibidos no detalhe podem receber melhores ofertas via WebSocket apenas para o resultado aberto. O simulador continua usando o preço do catálogo, que não é uma cotação de execução real.

## Implantação

1. Confirme o projeto e a autenticação da CLI. O `project_id` de `supabase/config.toml`, o projeto vinculado pela CLI e o destino das credenciais devem ser o mesmo. Compare o histórico remoto e local antes de aplicar migrations; não use `db push` enquanto houver divergência não resolvida.
2. Aplique as migrations novas em ordem: `20261105001000_polymarket_event_catalog.sql`, `20261105011000_polymarket_sync_safety.sql`, `20261105013000_polymarket_catalog_query_indexes.sql`, `20261105014000_polymarket_cron_timeout.sql` e `20261105015000_polymarket_event_sync_grant.sql`. Revise eventuais outras migrations pendentes antes de aplicar o conjunto.
3. Publique `sync-polymarket-catalog` e seus arquivos `_shared` no projeto correto, preservando a configuração de autenticação do cron. Não copie chaves ou senhas para o repositório ou para mensagens.
4. Confirme a configuração do Vault, a URL e a credencial usadas pelo cron existente. Confira o status HTTP e o corpo da resposta da Edge Function nos logs: sucesso do job SQL isoladamente não confirma sucesso da chamada HTTP.
5. Verifique `last_success_at`, `last_error`, cursores, contagens de páginas, eventos e reconciliações. Teste retomada após interrupção, concorrência, filtros e confirmação de um mercado aberto e outro encerrado. Um ciclo concluído não garante que o catálogo seja uma fotografia instantânea enquanto a fonte muda.

O fallback de detalhes de evento pode ser parcial quando a Gamma estiver indisponível; a interface identifica os dados salvos como potencialmente desatualizados. A contagem na tela é da cache, não o total exato da Polymarket.
