-- Diagnóstico agregado e somente leitura; não expõe identificadores ou credenciais.
SELECT
  (SELECT count(*) FROM pushinpay_private.notifications WHERE revision > processed_revision) AS notificacoes_pendentes,
  (SELECT min(received_at) FROM pushinpay_private.notifications WHERE revision > processed_revision) AS notificacao_pendente_mais_antiga,
  (SELECT count(*) FROM pushinpay_private.operations WHERE direction = 'deposit' AND status = 'unknown') AS depositos_desconhecidos,
  (SELECT count(*) FROM pushinpay_private.operations WHERE direction = 'deposit' AND status = 'unknown' AND provider_id IS NULL) AS depositos_sem_identificador,
  (SELECT count(*) FROM pushinpay_private.operations WHERE direction = 'deposit' AND status IN ('submitting', 'created')) AS depositos_em_andamento;
