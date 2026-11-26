-- Private foundation only: no application role can access this schema or its functions.
-- Amounts are integer pUSD base units; no deposits, trading or payouts are enabled.
CREATE SCHEMA IF NOT EXISTS shared_wallet_private;
REVOKE ALL ON SCHEMA shared_wallet_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE shared_wallet_private.balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  available bigint NOT NULL DEFAULT 0 CHECK (available >= 0),
  reserved bigint NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shared_wallet_private.reservations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES shared_wallet_private.balances(user_id),
  initial_amount bigint NOT NULL CHECK (initial_amount > 0),
  remaining_amount bigint NOT NULL CHECK (remaining_amount >= 0 AND remaining_amount <= initial_amount),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shared_wallet_private.entries (
  id uuid PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES shared_wallet_private.reservations(id),
  action text NOT NULL CHECK (action IN ('reserve', 'release', 'consume')),
  amount bigint NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON ALL TABLES IN SCHEMA shared_wallet_private FROM PUBLIC, anon, authenticated, service_role;

-- Callers must eventually verify external events and authorization before invoking these
-- functions. No EXECUTE is granted to any application role in this migration.
CREATE FUNCTION shared_wallet_private.reserve(p_user uuid, p_reservation uuid, p_amount bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, shared_wallet_private AS $$
DECLARE existing shared_wallet_private.reservations%ROWTYPE;
BEGIN
  IF p_user IS NULL OR p_reservation IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid reservation';
  END IF;
  -- Lock the account before inspecting idempotency, including concurrent retries.
  PERFORM 1 FROM shared_wallet_private.balances WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'balance not found'; END IF;
  SELECT * INTO existing FROM shared_wallet_private.reservations WHERE id = p_reservation;
  IF FOUND THEN
    IF existing.user_id <> p_user OR existing.initial_amount <> p_amount THEN RAISE EXCEPTION 'reservation conflict'; END IF;
    RETURN;
  END IF;
  UPDATE shared_wallet_private.balances SET available = available - p_amount, reserved = reserved + p_amount, updated_at = now()
   WHERE user_id = p_user AND available >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient available balance'; END IF;
  INSERT INTO shared_wallet_private.reservations(id, user_id, initial_amount, remaining_amount)
    VALUES (p_reservation, p_user, p_amount, p_amount);
  INSERT INTO shared_wallet_private.entries(id, reservation_id, action, amount)
    VALUES (p_reservation, p_reservation, 'reserve', p_amount);
END $$;

CREATE FUNCTION shared_wallet_private.settle_reservation(p_user uuid, p_reservation uuid, p_entry uuid, p_action text, p_amount bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, shared_wallet_private AS $$
DECLARE prior shared_wallet_private.entries%ROWTYPE; remaining bigint;
BEGIN
  IF p_user IS NULL OR p_reservation IS NULL OR p_entry IS NULL OR p_action IS NULL OR p_action NOT IN ('release', 'consume') OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid settlement';
  END IF;
  PERFORM 1 FROM shared_wallet_private.balances WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'balance not found'; END IF;
  SELECT remaining_amount INTO remaining FROM shared_wallet_private.reservations WHERE id = p_reservation AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found'; END IF;
  SELECT * INTO prior FROM shared_wallet_private.entries WHERE id = p_entry;
  IF FOUND THEN
    IF prior.reservation_id <> p_reservation OR prior.action <> p_action OR prior.amount <> p_amount THEN RAISE EXCEPTION 'entry conflict'; END IF;
    RETURN;
  END IF;
  IF remaining < p_amount THEN RAISE EXCEPTION 'insufficient reservation'; END IF;
  UPDATE shared_wallet_private.reservations SET remaining_amount = remaining_amount - p_amount WHERE id = p_reservation;
  UPDATE shared_wallet_private.balances SET reserved = reserved - p_amount,
    available = available + CASE WHEN p_action = 'release' THEN p_amount ELSE 0 END, updated_at = now()
    WHERE user_id = p_user AND reserved >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'inconsistent reserved balance'; END IF;
  INSERT INTO shared_wallet_private.entries(id, reservation_id, action, amount) VALUES (p_entry, p_reservation, p_action, p_amount);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shared_wallet_private FROM PUBLIC, anon, authenticated, service_role;
