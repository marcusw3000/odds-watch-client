# Retirada dos mercados antigos

Após confirmação explícita, a migration `20261106003000_retire_legacy_markets.sql` foi aplicada ao projeto Odds-Watch em 6 de novembro de 2026. Uma cópia dos registros das quatro tabelas com dados foi salva em `legacy-markets-backup-20261106.json.local`, arquivo local ignorado pelo Git. O conteúdo é uma exportação JSON; não é um backup completo do banco.

O arquivo `supabase/tests/retire_legacy_markets_candidate.sql` é uma cópia da versão ensaiada em uma cópia isolada do esquema remoto em PostgreSQL 17. Os testes de perfil, operações e moderação Polymarket passaram após a remoção simulada. Um favorito antigo de teste impediu a execução, conforme esperado.

A migration removeu as tabelas `markets`, `market_options`, `market_settlements`, `market_price_history`, `contestations`, `user_contracts`, `transactions`, `user_favorites`, `comments`, `comment_likes`, `comment_reports`, `copied_trades`, `copy_trade_commissions`, `copy_subscriptions`, `copy_trade_settings`, `copy_traders`, `achievements` e `user_achievements`, além de funções específicas do sistema antigo. A referência de chave estrangeira de `profiles` a `copy_traders` foi removida, mas a tabela `profiles` foi mantida. As funções de atualização de indicação foram adaptadas para não dependerem das conquistas antigas.

Na conferência, havia 6 mercados, 3 opções, 40 definições de conquistas e 1 configuração de copy trading; as demais tabelas acima estavam vazias. A proposta interrompe a execução se houver dados novos nas tabelas de atividade ou se os totais das definições ultrapassarem esses limites. A exclusão dos dados restantes seria permanente; essas contagens devem ser verificadas novamente antes de qualquer aplicação.

O catálogo, favoritos, comentários e carteira paper Polymarket, bem como `profiles`, `wallets`, `payments` e os dados financeiros, não fazem parte da remoção proposta. A migration já publicada de moderação adiciona `polymarket_comment_reports` e a coluna `polymarket_event_comments.is_hidden`.

Os arquivos de componentes antigos ainda presentes no repositório e as Edge Functions antigas publicadas devem ser aposentados ou adaptados antes de serem reutilizados; as rotas locais desses componentes foram removidas. A versão adaptada do aplicativo precisa ser publicada separadamente para atingir qualquer instalação hospedada.
