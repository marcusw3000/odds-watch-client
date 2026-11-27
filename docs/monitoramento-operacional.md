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

O alerta de disco usa a função `check-disk-health`, agendada a cada dez minutos, com limite de 80% e repetição máxima a cada seis horas enquanto a condição persistir. A recuperação e a deduplicação foram testadas em banco isolado; o job e uma verificação real foram confirmados em produção. O envio externo por e-mail ou mensageria não está configurado.

As migrations de duração de ciclo registram o tempo entre o início e a conclusão de cada ciclo de mercados e eventos. Os valores aparecem somente após um ciclo completo posterior à implantação; não reinicie o cron pausado apenas para gerar uma amostra.
