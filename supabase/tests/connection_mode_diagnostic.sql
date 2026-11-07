SELECT current_user, current_setting('default_transaction_read_only') AS default_mode,
  current_setting('transaction_read_only') AS transaction_mode, pg_is_in_recovery() AS recovery,
  (SELECT source FROM pg_settings WHERE name='default_transaction_read_only') AS mode_source;
