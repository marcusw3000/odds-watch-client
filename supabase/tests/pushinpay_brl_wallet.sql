-- Executar apenas em banco descartável com as migrations aplicadas.
BEGIN;
INSERT INTO auth.users(id, email) VALUES
 ('00000000-0000-4000-8000-000000000071', 'brl71@example.test'),
 ('00000000-0000-4000-8000-000000000072', 'brl72@example.test');
SELECT pushinpay_private.prepare_operation('10000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000071', 'deposit', 1000, repeat('a',64));
SELECT pushinpay_private.claim_submission('10000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000071');
SELECT pushinpay_private.record_deposit_created('10000000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000071', 'deposit-71', 1000, 'pix-test');
SELECT public.pushinpay_enqueue_notification('deposit-71');
SELECT public.pushinpay_claim_notification('30000000-0000-4000-8000-000000000071');
SELECT public.pushinpay_complete_notification('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071','deposit-71',1000,1,'paid','30000000-0000-4000-8000-000000000071');
SELECT pushinpay_private.credit_paid_deposit('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071');
SELECT public.pushinpay_prepare_brl_withdrawal('20000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071',400,repeat('b',64),'encrypted-test');
SELECT public.pushinpay_prepare_brl_withdrawal('20000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071',400,repeat('b',64),'encrypted-test');
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pushinpay_private.brl_balances WHERE user_id='00000000-0000-4000-8000-000000000071' AND available_cents=600 AND reserved_cents=400) THEN RAISE EXCEPTION 'incorrect balance'; END IF;
 IF (SELECT count(*) FROM pushinpay_private.brl_entries) <> 2 THEN RAISE EXCEPTION 'duplicate entries'; END IF;
 IF jsonb_array_length(public.pushinpay_list_operations('00000000-0000-4000-8000-000000000072')) <> 0 THEN RAISE EXCEPTION 'cross-user history leak'; END IF;
 IF jsonb_array_length(public.pushinpay_list_operations('00000000-0000-4000-8000-000000000071')) <> 2 THEN RAISE EXCEPTION 'missing history'; END IF;
 IF has_function_privilege('authenticated','public.pushinpay_prepare_brl_withdrawal(uuid,uuid,bigint,text,text)','EXECUTE') THEN RAISE EXCEPTION 'unexpected access'; END IF;
 BEGIN
   PERFORM public.pushinpay_prepare_brl_withdrawal('20000000-0000-4000-8000-000000000072','00000000-0000-4000-8000-000000000071',601,repeat('c',64),'encrypted-test');
   RAISE EXCEPTION 'insufficient funds accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'insufficient balance' THEN RAISE; END IF; END;
 IF EXISTS (SELECT 1 FROM pushinpay_private.operations WHERE id='20000000-0000-4000-8000-000000000072') THEN RAISE EXCEPTION 'failed withdrawal persisted'; END IF;
END $$;
SELECT public.pushinpay_claim_withdrawal('20000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071');
SELECT public.pushinpay_register_withdrawal('20000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071','withdrawal-71',400);
UPDATE pushinpay_private.verification_limit SET last_claimed_at = NULL;
SELECT public.pushinpay_claim_notification_v2('30000000-0000-4000-8000-000000000072', true);
SELECT public.pushinpay_complete_notification('20000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071','withdrawal-71',400,1,'canceled','30000000-0000-4000-8000-000000000072');
SELECT pushinpay_private.settle_brl_withdrawal('20000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pushinpay_private.brl_balances WHERE user_id='00000000-0000-4000-8000-000000000071' AND available_cents=1000 AND reserved_cents=0) THEN RAISE EXCEPTION 'incorrect refund'; END IF;
END $$;
SELECT public.pushinpay_prepare_brl_withdrawal('20000000-0000-4000-8000-000000000073','00000000-0000-4000-8000-000000000071',600,repeat('d',64),'encrypted-test');
SELECT public.pushinpay_claim_withdrawal('20000000-0000-4000-8000-000000000073','00000000-0000-4000-8000-000000000071');
SELECT public.pushinpay_register_withdrawal('20000000-0000-4000-8000-000000000073','00000000-0000-4000-8000-000000000071','withdrawal-73',600);
UPDATE pushinpay_private.verification_limit SET last_claimed_at = NULL;
SELECT public.pushinpay_claim_notification_v2('30000000-0000-4000-8000-000000000073', true);
SELECT public.pushinpay_complete_notification('20000000-0000-4000-8000-000000000073','00000000-0000-4000-8000-000000000071','withdrawal-73',600,1,'paid','30000000-0000-4000-8000-000000000073');
SELECT pushinpay_private.settle_brl_withdrawal('20000000-0000-4000-8000-000000000073','00000000-0000-4000-8000-000000000071');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pushinpay_private.brl_balances WHERE user_id='00000000-0000-4000-8000-000000000071' AND available_cents=400 AND reserved_cents=0) THEN RAISE EXCEPTION 'incorrect paid withdrawal'; END IF;
END $$;
SELECT pushinpay_private.prepare_operation('10000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000072','deposit',500,repeat('e',64));
SELECT pushinpay_private.claim_submission('10000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000072');
SELECT pushinpay_private.record_deposit_created('10000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000072','deposit-expired',500,'pix');
SELECT public.pushinpay_enqueue_notification('deposit-expired');
UPDATE pushinpay_private.verification_limit SET last_claimed_at = NULL;
SELECT public.pushinpay_claim_notification_v2('30000000-0000-4000-8000-000000000074',true);
SELECT public.pushinpay_complete_notification('10000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000072','deposit-expired',500,1,'expired','30000000-0000-4000-8000-000000000074');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pushinpay_private.brl_balances WHERE user_id='00000000-0000-4000-8000-000000000072') THEN RAISE EXCEPTION 'expired deposit credited'; END IF;
END $$;
DO $$ BEGIN
 IF public.pushinpay_request_deposit_recheck('10000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000071') THEN RAISE EXCEPTION 'cross-user recheck allowed'; END IF;
 IF NOT public.pushinpay_request_deposit_recheck('10000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000072') THEN RAISE EXCEPTION 'owner recheck failed'; END IF;
END $$;
UPDATE pushinpay_private.verification_limit SET last_claimed_at = NULL;
SELECT public.pushinpay_claim_notification_v2('30000000-0000-4000-8000-000000000075',true);
SELECT public.pushinpay_complete_notification('10000000-0000-4000-8000-000000000074','00000000-0000-4000-8000-000000000072','deposit-expired',500,2,'paid','30000000-0000-4000-8000-000000000075');
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pushinpay_private.brl_balances WHERE user_id='00000000-0000-4000-8000-000000000072' AND available_cents=500) THEN RAISE EXCEPTION 'late payment not credited'; END IF;
END $$;
ROLLBACK;
