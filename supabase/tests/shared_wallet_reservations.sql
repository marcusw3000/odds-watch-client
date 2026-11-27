-- Run only in a disposable local database after applying migrations.
BEGIN;
INSERT INTO auth.users(id, email) VALUES
 ('00000000-0000-4000-8000-000000000081', 'pool81@example.test'),
 ('00000000-0000-4000-8000-000000000082', 'pool82@example.test');
INSERT INTO shared_wallet_private.balances(user_id, available) VALUES
 ('00000000-0000-4000-8000-000000000081', 100),
 ('00000000-0000-4000-8000-000000000082', 100);
SELECT shared_wallet_private.reserve('00000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000001', 80);
SELECT shared_wallet_private.reserve('00000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000001', 80);
SELECT shared_wallet_private.settle_reservation('00000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'consume', 50);
SELECT shared_wallet_private.settle_reservation('00000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'consume', 50);
SELECT shared_wallet_private.settle_reservation('00000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'release', 30);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM shared_wallet_private.balances WHERE user_id='00000000-0000-4000-8000-000000000081' AND available=50 AND reserved=0) THEN RAISE EXCEPTION 'incorrect balance'; END IF;
 IF (SELECT count(*) FROM shared_wallet_private.entries) <> 3 THEN RAISE EXCEPTION 'duplicate entries'; END IF;
 IF has_schema_privilege('authenticated', 'shared_wallet_private', 'USAGE') OR has_schema_privilege('service_role', 'shared_wallet_private', 'USAGE') THEN RAISE EXCEPTION 'unexpected application access'; END IF;
 BEGIN
   PERFORM shared_wallet_private.settle_reservation('00000000-0000-4000-8000-000000000082', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'release', 1);
   RAISE EXCEPTION 'cross-user access accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'reservation not found' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM shared_wallet_private.reserve('00000000-0000-4000-8000-000000000081', '10000000-0000-4000-8000-000000000002', 51);
   RAISE EXCEPTION 'overdraft accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'insufficient available balance' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
