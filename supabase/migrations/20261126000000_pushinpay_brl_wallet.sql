-- Contabilidade PIX em centavos de BRL, separada das carteiras virtuais e pUSD.
ALTER TABLE pushinpay_private.operations DROP CONSTRAINT operations_status_check;
ALTER TABLE pushinpay_private.operations ADD CONSTRAINT operations_status_check CHECK (status IN ('prepared', 'submitting', 'unknown', 'created', 'paid', 'canceled', 'expired'));
ALTER TABLE pushinpay_private.operations ADD CONSTRAINT operations_expired_deposit CHECK (status <> 'expired' OR (direction = 'deposit' AND provider_id IS NOT NULL));

CREATE OR REPLACE FUNCTION pushinpay_private.record_provider_status(p_id uuid, p_user uuid, p_provider_id text, p_status text)
RETURNS pushinpay_private.operations LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE result pushinpay_private.operations%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_user IS NULL OR p_provider_id IS NULL OR p_provider_id !~ '^[A-Za-z0-9-]{1,100}$' OR
     p_status IS NULL OR p_status NOT IN ('created', 'paid', 'canceled', 'expired') THEN RAISE EXCEPTION 'invalid provider status'; END IF;
  SELECT * INTO result FROM pushinpay_private.operations WHERE id = p_id AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation not found'; END IF;
  IF result.provider_id IS NOT NULL AND lower(result.provider_id) <> lower(p_provider_id) THEN RAISE EXCEPTION 'provider conflict'; END IF;
  IF (p_status = 'expired' AND result.direction <> 'deposit') OR
     result.status NOT IN ('submitting', 'unknown', 'created', 'paid', 'canceled', 'expired') OR
     (result.status IN ('paid', 'canceled') AND result.status <> p_status) OR
     (result.status = 'expired' AND p_status NOT IN ('expired', 'paid')) THEN RAISE EXCEPTION 'invalid status transition'; END IF;
  UPDATE pushinpay_private.operations SET provider_id = COALESCE(provider_id, p_provider_id), status = p_status, updated_at = now()
  WHERE id = p_id RETURNING * INTO result;
  RETURN result;
END $$;

CREATE TABLE pushinpay_private.brl_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  available_cents bigint NOT NULL DEFAULT 0 CHECK (available_cents BETWEEN 0 AND 9007199254740991),
  reserved_cents bigint NOT NULL DEFAULT 0 CHECK (reserved_cents BETWEEN 0 AND 9007199254740991),
  CHECK (available_cents + reserved_cents <= 9007199254740991),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pushinpay_private.brl_entries (
  operation_id uuid NOT NULL REFERENCES pushinpay_private.operations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('deposit_credit', 'withdrawal_reserve', 'withdrawal_paid', 'withdrawal_release')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operation_id, kind)
);
REVOKE ALL ON pushinpay_private.brl_balances, pushinpay_private.brl_entries FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE pushinpay_private.operations ADD COLUMN withdrawal_destination_ciphertext text CHECK (withdrawal_destination_ciphertext IS NULL OR length(withdrawal_destination_ciphertext) BETWEEN 1 AND 4096);

-- Reserva o valor e grava a solicitação na mesma transação. O destino é cifrado
-- pelo servidor antes de ser recebido pelo banco.
CREATE FUNCTION public.pushinpay_prepare_brl_withdrawal(p_id uuid, p_user_id uuid, p_amount_cents bigint, p_fingerprint text, p_destination_ciphertext text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE op pushinpay_private.operations%ROWTYPE; inserted integer;
BEGIN
  IF p_destination_ciphertext IS NULL OR length(p_destination_ciphertext) NOT BETWEEN 1 AND 4096 THEN RAISE EXCEPTION 'invalid destination'; END IF;
  SELECT * INTO op FROM pushinpay_private.prepare_operation(p_id, p_user_id, 'withdrawal', p_amount_cents, p_fingerprint);
  IF op.withdrawal_destination_ciphertext IS NULL THEN
    UPDATE pushinpay_private.operations SET withdrawal_destination_ciphertext = p_destination_ciphertext WHERE id = p_id RETURNING * INTO op;
  END IF;
  INSERT INTO pushinpay_private.brl_entries(operation_id, user_id, kind, amount_cents)
  VALUES (p_id, p_user_id, 'withdrawal_reserve', p_amount_cents) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 1 THEN
    UPDATE pushinpay_private.brl_balances SET available_cents = available_cents - p_amount_cents, reserved_cents = reserved_cents + p_amount_cents, updated_at = now()
    WHERE user_id = p_user_id AND available_cents >= p_amount_cents;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient balance'; END IF;
  END IF;
  RETURN to_jsonb(op) - 'withdrawal_destination_ciphertext' - 'request_fingerprint';
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_prepare_brl_withdrawal(uuid, uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_prepare_brl_withdrawal(uuid, uuid, bigint, text, text) TO service_role;

CREATE FUNCTION public.pushinpay_claim_withdrawal(p_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
BEGIN
  UPDATE pushinpay_private.operations SET status = 'submitting', updated_at = now()
  WHERE id = p_id AND user_id = p_user_id AND direction = 'withdrawal' AND status = 'prepared';
  RETURN FOUND;
END $$;

CREATE FUNCTION public.pushinpay_get_withdrawal(p_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
  SELECT to_jsonb(o) - 'withdrawal_destination_ciphertext' - 'request_fingerprint'
  FROM pushinpay_private.operations o WHERE o.id = p_id AND o.user_id = p_user_id AND o.direction = 'withdrawal'
$$;

CREATE FUNCTION public.pushinpay_mark_withdrawal_unknown(p_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
BEGIN
  UPDATE pushinpay_private.operations SET status = 'unknown', updated_at = now()
  WHERE id = p_id AND user_id = p_user_id AND direction = 'withdrawal' AND status = 'submitting';
  RETURN FOUND;
END $$;

CREATE FUNCTION public.pushinpay_register_withdrawal(p_id uuid, p_user_id uuid, p_provider_id text, p_amount_cents bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE op pushinpay_private.operations%ROWTYPE;
BEGIN
  SELECT * INTO op FROM pushinpay_private.operations WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR op.direction <> 'withdrawal' OR op.amount_cents <> p_amount_cents OR
     NOT EXISTS (SELECT 1 FROM pushinpay_private.brl_entries WHERE operation_id = p_id AND kind = 'withdrawal_reserve') THEN RAISE EXCEPTION 'invalid withdrawal'; END IF;
  SELECT * INTO op FROM pushinpay_private.record_provider_status(p_id, p_user_id, p_provider_id, 'created');
  PERFORM public.pushinpay_enqueue_notification(p_provider_id);
  RETURN to_jsonb(op) - 'withdrawal_destination_ciphertext' - 'request_fingerprint';
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_claim_withdrawal(uuid, uuid), public.pushinpay_get_withdrawal(uuid, uuid), public.pushinpay_mark_withdrawal_unknown(uuid, uuid), public.pushinpay_register_withdrawal(uuid, uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_claim_withdrawal(uuid, uuid), public.pushinpay_get_withdrawal(uuid, uuid), public.pushinpay_mark_withdrawal_unknown(uuid, uuid), public.pushinpay_register_withdrawal(uuid, uuid, text, bigint) TO service_role;

-- O valor só é liberado quando o cancelamento é confirmado no provedor.
CREATE FUNCTION pushinpay_private.settle_brl_withdrawal(p_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE op pushinpay_private.operations%ROWTYPE; entry_kind text; inserted integer;
BEGIN
  SELECT * INTO op FROM pushinpay_private.operations WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR op.direction <> 'withdrawal' OR op.status NOT IN ('paid', 'canceled') THEN RAISE EXCEPTION 'withdrawal not settled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pushinpay_private.brl_entries WHERE operation_id = p_id AND user_id = p_user_id AND kind = 'withdrawal_reserve' AND amount_cents = op.amount_cents) THEN RAISE EXCEPTION 'reservation not found'; END IF;
  entry_kind := CASE WHEN op.status = 'paid' THEN 'withdrawal_paid' ELSE 'withdrawal_release' END;
  INSERT INTO pushinpay_private.brl_entries(operation_id, user_id, kind, amount_cents) VALUES (p_id, p_user_id, entry_kind, op.amount_cents) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 1 THEN
    UPDATE pushinpay_private.brl_balances SET reserved_cents = reserved_cents - op.amount_cents,
      available_cents = available_cents + CASE WHEN op.status = 'canceled' THEN op.amount_cents ELSE 0 END, updated_at = now()
    WHERE user_id = p_user_id AND reserved_cents >= op.amount_cents;
    IF NOT FOUND THEN RAISE EXCEPTION 'inconsistent reservation'; END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION pushinpay_private.settle_brl_withdrawal(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Invocada na mesma transação que registra a confirmação verificada do provedor.
CREATE FUNCTION pushinpay_private.credit_paid_deposit(p_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE op pushinpay_private.operations%ROWTYPE; inserted integer;
BEGIN
  SELECT * INTO op FROM pushinpay_private.operations WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR op.direction <> 'deposit' OR op.status <> 'paid' THEN RAISE EXCEPTION 'deposit not paid'; END IF;
  INSERT INTO pushinpay_private.brl_balances(user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO pushinpay_private.brl_entries(operation_id, user_id, kind, amount_cents)
  VALUES (p_id, p_user_id, 'deposit_credit', op.amount_cents) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 1 THEN
    UPDATE pushinpay_private.brl_balances SET available_cents = available_cents + op.amount_cents, updated_at = now() WHERE user_id = p_user_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION pushinpay_private.credit_paid_deposit(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Recupera depósitos já confirmados pela conciliação anterior à criação da carteira.
DO $$
DECLARE paid_deposit record;
BEGIN
  FOR paid_deposit IN SELECT id, user_id FROM pushinpay_private.operations WHERE direction = 'deposit' AND status = 'paid' ORDER BY id LOOP
    PERFORM pushinpay_private.credit_paid_deposit(paid_deposit.id, paid_deposit.user_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.pushinpay_complete_notification(p_operation_id uuid, p_user_id uuid, p_provider_id text, p_amount_cents bigint, p_revision bigint, p_status text, p_lease_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE item pushinpay_private.notifications%ROWTYPE; op pushinpay_private.operations%ROWTYPE;
BEGIN
  SELECT * INTO item FROM pushinpay_private.notifications n WHERE n.provider_id = lower(p_provider_id) FOR UPDATE;
  IF NOT FOUND OR p_revision IS NULL OR p_revision < 1 OR p_revision > item.revision OR p_lease_id IS NULL OR item.lease_id IS DISTINCT FROM p_lease_id THEN RAISE EXCEPTION 'invalid notification revision or lease'; END IF;
  SELECT * INTO op FROM pushinpay_private.operations o WHERE o.id = p_operation_id AND o.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR op.amount_cents <> p_amount_cents OR lower(op.provider_id) <> lower(p_provider_id) THEN RAISE EXCEPTION 'operation mismatch'; END IF;
  PERFORM pushinpay_private.record_provider_status(p_operation_id, p_user_id, p_provider_id, p_status);
  IF op.direction = 'deposit' AND p_status = 'paid' THEN PERFORM pushinpay_private.credit_paid_deposit(p_operation_id, p_user_id); END IF;
  IF op.direction = 'withdrawal' AND p_status IN ('paid', 'canceled') THEN PERFORM pushinpay_private.settle_brl_withdrawal(p_operation_id, p_user_id); END IF;
  UPDATE pushinpay_private.notifications n SET processed_revision = greatest(n.processed_revision, p_revision), leased_until = NULL, lease_id = NULL WHERE n.provider_id = item.provider_id;
END $$;

CREATE FUNCTION public.pushinpay_claim_notification_v2(p_lease_id uuid, p_include_withdrawals boolean)
RETURNS TABLE(operation_id uuid, user_id uuid, provider_id text, amount_cents bigint, direction text, revision bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE item pushinpay_private.notifications%ROWTYPE; op pushinpay_private.operations%ROWTYPE;
BEGIN
  IF p_lease_id IS NULL THEN RAISE EXCEPTION 'invalid lease'; END IF;
  SELECT n.* INTO item FROM pushinpay_private.notifications n
  JOIN pushinpay_private.operations o ON lower(o.provider_id) = n.provider_id
  WHERE n.revision > n.processed_revision AND (n.leased_until IS NULL OR n.leased_until <= clock_timestamp())
    AND (o.direction = 'deposit' OR (o.direction = 'withdrawal' AND p_include_withdrawals IS TRUE))
  ORDER BY n.received_at FOR UPDATE OF n SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO op FROM pushinpay_private.operations o WHERE lower(o.provider_id) = item.provider_id;
  IF NOT pushinpay_private.claim_verification(op.id) THEN RETURN; END IF;
  UPDATE pushinpay_private.notifications n SET leased_until = clock_timestamp() + interval '60 seconds', lease_id = p_lease_id WHERE n.provider_id = item.provider_id;
  RETURN QUERY SELECT op.id, op.user_id, op.provider_id, op.amount_cents, op.direction, item.revision;
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_claim_notification_v2(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_claim_notification_v2(uuid, boolean) TO service_role;

CREATE FUNCTION public.pushinpay_seed_reconciliation_v2(p_include_withdrawals boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE target text;
BEGIN
  SELECT o.provider_id INTO target FROM pushinpay_private.operations o
  WHERE (o.direction = 'deposit' OR (o.direction = 'withdrawal' AND p_include_withdrawals IS TRUE))
    AND o.status = 'created' AND o.provider_id IS NOT NULL AND o.updated_at < now() - interval '2 minutes'
    AND NOT EXISTS (SELECT 1 FROM pushinpay_private.notifications n WHERE n.provider_id = lower(o.provider_id) AND n.revision > n.processed_revision)
  ORDER BY o.updated_at LIMIT 1;
  IF target IS NULL THEN RETURN false; END IF;
  PERFORM public.pushinpay_enqueue_notification(target);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_seed_reconciliation_v2(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_seed_reconciliation_v2(boolean) TO service_role;

CREATE FUNCTION public.pushinpay_brl_balance(p_user_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
  SELECT jsonb_build_object('available_cents', COALESCE((SELECT available_cents FROM pushinpay_private.brl_balances WHERE user_id = p_user_id), 0),
                            'reserved_cents', COALESCE((SELECT reserved_cents FROM pushinpay_private.brl_balances WHERE user_id = p_user_id), 0))
$$;
REVOKE ALL ON FUNCTION public.pushinpay_brl_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_brl_balance(uuid) TO service_role;

CREATE FUNCTION public.pushinpay_list_operations(p_user_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object('id', id, 'direction', direction, 'valueCents', amount_cents, 'status', status,
                              'pixCode', CASE WHEN direction = 'deposit' AND status = 'created' THEN pix_code ELSE NULL END,
                              'createdAt', created_at) AS row_data, created_at
    FROM pushinpay_private.operations WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 30
  ) recent
$$;
REVOKE ALL ON FUNCTION public.pushinpay_list_operations(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_list_operations(uuid) TO service_role;

-- O usuário pode solicitar uma nova consulta sem chamar a Pushin Pay diretamente.
CREATE FUNCTION public.pushinpay_request_deposit_recheck(p_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE target text;
BEGIN
  SELECT o.provider_id INTO target FROM pushinpay_private.operations o
  WHERE o.id = p_id AND o.user_id = p_user_id AND o.direction = 'deposit';
  IF target IS NULL THEN RETURN false; END IF;
  PERFORM public.pushinpay_enqueue_notification(target);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_request_deposit_recheck(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_request_deposit_recheck(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
