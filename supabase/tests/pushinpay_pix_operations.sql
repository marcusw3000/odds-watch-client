-- Executar somente em banco local descartável com as migrations aplicadas.
BEGIN;
INSERT INTO auth.users(id, email) VALUES
 ('00000000-0000-4000-8000-000000000091', 'pix91@example.test'),
 ('00000000-0000-4000-8000-000000000092', 'pix92@example.test');
INSERT INTO shared_wallet_private.balances(user_id, available) VALUES ('00000000-0000-4000-8000-000000000092', 1000);
SELECT pushinpay_private.prepare_operation('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091', 'deposit', 1000, repeat('a', 64));
SELECT public.pushinpay_enqueue_notification('ABC-123');
SELECT public.pushinpay_enqueue_notification('abc-123');
SELECT pushinpay_private.prepare_operation('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091', 'deposit', 1000, repeat('a', 64));
DO $$
BEGIN
  IF (SELECT revision FROM pushinpay_private.notifications WHERE provider_id = 'abc-123') <> 2 THEN RAISE EXCEPTION 'notification revision failed'; END IF;
  IF has_function_privilege('authenticated', 'public.pushinpay_enqueue_notification(text)', 'EXECUTE') OR NOT has_function_privilege('service_role', 'public.pushinpay_enqueue_notification(text)', 'EXECUTE') THEN RAISE EXCEPTION 'queue permissions invalid'; END IF;
  IF has_function_privilege('authenticated', 'public.pushinpay_prepare_deposit(uuid,uuid,bigint,text)', 'EXECUTE') OR NOT has_function_privilege('service_role', 'public.pushinpay_prepare_deposit(uuid,uuid,bigint,text)', 'EXECUTE') THEN RAISE EXCEPTION 'deposit permissions invalid'; END IF;
  IF public.pushinpay_get_deposit('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000092') IS NOT NULL THEN RAISE EXCEPTION 'cross-user read'; END IF;
  PERFORM public.pushinpay_prepare_deposit('10000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000092', 500, repeat('b', 64));
  IF NOT public.pushinpay_claim_deposit('10000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000092') THEN RAISE EXCEPTION 'deposit claim failed'; END IF;
  PERFORM public.pushinpay_save_deposit('10000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000092', 'other-id', 500, 'pix-code');
  IF public.pushinpay_get_deposit('10000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000092')->>'pix_code' <> 'pix-code' THEN RAISE EXCEPTION 'deposit code not saved'; END IF;
  UPDATE pushinpay_private.operations SET updated_at = now() - interval '3 minutes' WHERE id = '10000000-0000-4000-8000-000000000092';
  IF NOT public.pushinpay_seed_reconciliation() THEN RAISE EXCEPTION 'missing notification was not queued'; END IF;
  IF public.pushinpay_seed_reconciliation() THEN RAISE EXCEPTION 'pending notification duplicated'; END IF;
  UPDATE pushinpay_private.notifications SET processed_revision = revision WHERE provider_id = 'other-id';
  PERFORM pushinpay_private.prepare_withdrawal('40000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000092', 500, 400, repeat('c', 64));
  PERFORM pushinpay_private.prepare_withdrawal('40000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000092', 500, 400, repeat('c', 64));
  IF NOT EXISTS (SELECT 1 FROM shared_wallet_private.balances WHERE user_id = '00000000-0000-4000-8000-000000000092' AND available = 600 AND reserved = 400) THEN RAISE EXCEPTION 'withdrawal reservation invalid'; END IF;
  BEGIN
    PERFORM pushinpay_private.prepare_withdrawal('40000000-0000-4000-8000-000000000093', '00000000-0000-4000-8000-000000000092', 500, 601, repeat('d', 64));
    RAISE EXCEPTION 'insufficient funds accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'insufficient available balance' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM pushinpay_private.operations WHERE id = '40000000-0000-4000-8000-000000000093') THEN RAISE EXCEPTION 'failed withdrawal persisted'; END IF;
  IF NOT pushinpay_private.claim_submission('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'first claim failed'; END IF;
  IF pushinpay_private.claim_submission('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'duplicate claim'; END IF;
  IF pushinpay_private.mark_unknown('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000092') THEN RAISE EXCEPTION 'cross-user change'; END IF;
  IF NOT pushinpay_private.mark_unknown('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'unknown state failed'; END IF;
  IF pushinpay_private.claim_submission('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'unsafe retry'; END IF;
  PERFORM pushinpay_private.record_provider_status('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091', 'abc', 'paid');
  PERFORM pushinpay_private.record_provider_status('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091', 'ABC', 'paid');
  IF NOT pushinpay_private.claim_verification('10000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'first verification claim failed'; END IF;
  IF pushinpay_private.claim_verification('10000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'verification rate limit failed'; END IF;
  UPDATE pushinpay_private.verification_limit SET last_claimed_at = NULL;
  PERFORM public.pushinpay_enqueue_notification('ABC');
  IF (SELECT count(*) FROM public.pushinpay_claim_notification('30000000-0000-4000-8000-000000000091')) <> 1 THEN RAISE EXCEPTION 'queue claim failed'; END IF;
  PERFORM public.pushinpay_enqueue_notification('abc');
  PERFORM public.pushinpay_complete_notification('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091', 'abc', 1000, 1, 'paid', '30000000-0000-4000-8000-000000000091');
  IF (SELECT revision - processed_revision FROM pushinpay_private.notifications WHERE provider_id = 'abc') <> 1 THEN RAISE EXCEPTION 'lost concurrent notification'; END IF;
  BEGIN
    PERFORM pushinpay_private.record_provider_status('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000091', 'abc', 'created');
    RAISE EXCEPTION 'terminal state changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid status transition' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM pushinpay_private.prepare_operation('10000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000092', 'deposit', 1000, repeat('a', 64));
    RAISE EXCEPTION 'identity mismatch accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'operation conflict' THEN RAISE; END IF;
  END;
  IF has_schema_privilege('authenticated', 'pushinpay_private', 'USAGE') OR has_schema_privilege('service_role', 'pushinpay_private', 'USAGE') THEN RAISE EXCEPTION 'unexpected access'; END IF;
END $$;
ROLLBACK;
