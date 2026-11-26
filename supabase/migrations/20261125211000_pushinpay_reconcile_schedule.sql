-- Agendamento de conciliação. Os valores devem existir no Vault antes do uso:
-- pushinpay_reconcile_url e pushinpay_reconcile_secret.
-- A função remota processa no máximo uma consulta por execução.
DO $schedule$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL AND to_regnamespace('net') IS NOT NULL AND to_regnamespace('vault') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pushinpay-reconcile') THEN
      PERFORM cron.schedule('pushinpay-reconcile', '* * * * *', $job$
        SELECT net.http_get(
          url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pushinpay_reconcile_url'),
          headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pushinpay_reconcile_secret')),
          timeout_milliseconds := 20000
        )
        WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'pushinpay_reconcile_url' AND decrypted_secret <> '')
          AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'pushinpay_reconcile_secret' AND decrypted_secret <> '')
      $job$);
    END IF;
  END IF;
END;
$schedule$;
