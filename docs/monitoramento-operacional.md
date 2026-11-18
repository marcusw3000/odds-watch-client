# Monitoramento operacional

O painel `/admin/system` mostra métricas agregadas para administradores. Os avisos do painel não enviam notificações e só são vistos enquanto ele é consultado.

- **Catálogo:** se houver erro, consulte os logs da função `sync-polymarket-catalog` e a resposta HTTP. A última atualização de um mercado ou o sucesso do cron não prova que todo o catálogo foi sincronizado.
- **Copy Trading:** a verificação mais antiga acima de 15 minutos indica possível atraso. Confira estratégias ativas, logs de `process-paper-copy` e resposta HTTP; sinais pendentes podem estar aguardando aprovação manual.
- **Portfólio:** uma tentativa posterior ao último sucesso pode indicar falha ou execução em andamento. Consulte os logs de `snapshot-paper-portfolio` antes de concluir que houve erro.
- **Armazenamento:** o tamanho do banco e das tabelas não é o uso total de disco. Confira capacidade, WAL e avisos no painel de infraestrutura do Supabase antes de realizar limpeza ou reativar cron.
- **Cron:** o estado do job não confirma a resposta da Edge Function acionada. Verifique logs HTTP e da função. Não reative a sincronização completa sem validar espaço e processamento incremental.

## Alertas automáticos propostos

A migration `20261118020000_operational_alerts.sql` prepara notificações internas para administradores a cada 10 minutos. Uma condição contínua gera nova notificação no máximo a cada seis horas; quando se resolve e retorna, pode gerar nova notificação. Um bloqueio transacional impede verificações concorrentes. Sinais pendentes e agendamentos pausados não são tratados como falha automaticamente.

Os avisos cobrem erro registrado no catálogo, verificação de Copy Trading atrasada por mais de 15 minutos, tentativa de amostragem de portfólio sem sucesso posterior por mais de 15 minutos e falha do último cron ativo. O cron só informa o estado do comando agendado; a resposta HTTP precisa de verificação separada. A capacidade total de disco e a duração dos ciclos ainda não são monitoradas por este mecanismo.

Antes de aplicar em produção, execute testes em banco isolado para permissões, duplicidade, recuperação e ausência de administradores, e confirme que os alertas não geram ruído com o cron pausado. O envio externo por e-mail ou mensageria não está configurado. Se a migration ainda não tiver sido aplicada, não há monitoramento automático ativo.
