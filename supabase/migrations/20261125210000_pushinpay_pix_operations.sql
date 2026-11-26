-- Preparação privada para conciliação. Nenhum papel da aplicação recebe acesso.
-- Valores PIX são centavos de BRL e não representam saldo em pUSD.
CREATE SCHEMA IF NOT EXISTS pushinpay_private;
REVOKE ALL ON SCHEMA pushinpay_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE pushinpay_private.operations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  direction text NOT NULL CHECK (direction IN ('deposit', 'withdrawal')),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 50 AND amount_cents <= 9007199254740991),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  provider_id text CHECK (provider_id IS NULL OR provider_id ~ '^[A-Za-z0-9-]{1,100}$'),
  pix_code text CHECK (pix_code IS NULL OR length(pix_code) BETWEEN 1 AND 8192),
  reserved_pusd bigint CHECK (reserved_pusd IS NULL OR reserved_pusd > 0),
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'submitting', 'unknown', 'created', 'paid', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('created', 'paid', 'canceled') OR provider_id IS NOT NULL)
);
CREATE UNIQUE INDEX pushinpay_operations_provider_id ON pushinpay_private.operations (lower(provider_id)) WHERE provider_id IS NOT NULL;

-- Limite compartilhado pela conta, inclusive entre instâncias e operações distintas.
CREATE TABLE pushinpay_private.verification_limit (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_claimed_at timestamptz
);
INSERT INTO pushinpay_private.verification_limit (singleton) VALUES (true);

-- A notificação pode chegar antes de o identificador ser vinculado à operação.
CREATE TABLE pushinpay_private.notifications (
  provider_id text PRIMARY KEY CHECK (provider_id ~ '^[a-z0-9-]{1,100}$'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  processed_revision bigint NOT NULL DEFAULT 0 CHECK (processed_revision >= 0 AND processed_revision <= revision),
  leased_until timestamptz,
  lease_id uuid,
  received_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA pushinpay_private FROM PUBLIC, anon, authenticated, service_role;

-- p_id é a chave de idempotência escolhida antes da chamada externa. O hash deve
-- vincular todos os parâmetros, inclusive o destino do saque, sem armazená-los aqui.
CREATE FUNCTION pushinpay_private.prepare_operation(p_id uuid, p_user uuid, p_direction text, p_amount_cents bigint, p_fingerprint text)
RETURNS pushinpay_private.operations LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE result pushinpay_private.operations%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_user IS NULL OR p_direction IS NULL OR p_direction NOT IN ('deposit', 'withdrawal') OR
     p_amount_cents IS NULL OR p_amount_cents < 50 OR p_amount_cents > 9007199254740991 OR
     p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid operation';
  END IF;
  INSERT INTO pushinpay_private.operations(id, user_id, direction, amount_cents, request_fingerprint)
  VALUES (p_id, p_user, p_direction, p_amount_cents, p_fingerprint)
  ON CONFLICT (id) DO NOTHING;
  SELECT * INTO STRICT result FROM pushinpay_private.operations WHERE id = p_id FOR UPDATE;
  IF result.user_id <> p_user OR result.direction <> p_direction OR result.amount_cents <> p_amount_cents OR result.request_fingerprint <> p_fingerprint THEN
    RAISE EXCEPTION 'operation conflict';
  END IF;
  RETURN result;
END $$;

-- Somente uma chamada pode receber true. Uma queda após a aquisição exige
-- conciliação, pois o provedor pode ter processado a solicitação.
CREATE FUNCTION pushinpay_private.claim_submission(p_id uuid, p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
BEGIN
  UPDATE pushinpay_private.operations SET status = 'submitting', updated_at = now()
  WHERE id = p_id AND user_id = p_user AND status = 'prepared';
  RETURN FOUND;
END $$;

-- Grava QR e identificador na mesma transação antes de mostrar a cobrança.
CREATE FUNCTION pushinpay_private.record_deposit_created(p_id uuid, p_user uuid, p_provider_id text, p_amount_cents bigint, p_pix_code text)
RETURNS pushinpay_private.operations LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE result pushinpay_private.operations%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_user IS NULL OR p_provider_id IS NULL OR p_provider_id !~ '^[A-Za-z0-9-]{1,100}$' OR
     p_amount_cents IS NULL OR p_pix_code IS NULL OR length(p_pix_code) NOT BETWEEN 1 AND 8192 THEN
    RAISE EXCEPTION 'invalid charge';
  END IF;
  SELECT * INTO result FROM pushinpay_private.operations WHERE id = p_id AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation not found'; END IF;
  IF result.direction <> 'deposit' OR result.amount_cents <> p_amount_cents OR
     (result.provider_id IS NOT NULL AND lower(result.provider_id) <> lower(p_provider_id)) OR
     (result.pix_code IS NOT NULL AND result.pix_code <> p_pix_code) THEN RAISE EXCEPTION 'charge conflict'; END IF;
  IF result.status NOT IN ('submitting', 'unknown', 'created', 'paid', 'canceled') THEN RAISE EXCEPTION 'invalid status transition'; END IF;
  UPDATE pushinpay_private.operations SET provider_id = COALESCE(provider_id, p_provider_id), pix_code = p_pix_code,
    status = CASE WHEN status IN ('submitting', 'unknown') THEN 'created' ELSE status END, updated_at = now()
  WHERE id = p_id RETURNING * INTO result;
  RETURN result;
END $$;

-- Aplicar apenas respostas consultadas e verificadas pelo servidor no provedor.
CREATE FUNCTION pushinpay_private.record_provider_status(p_id uuid, p_user uuid, p_provider_id text, p_status text)
RETURNS pushinpay_private.operations LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE result pushinpay_private.operations%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_user IS NULL OR p_provider_id IS NULL OR p_provider_id !~ '^[A-Za-z0-9-]{1,100}$' OR
     p_status IS NULL OR p_status NOT IN ('created', 'paid', 'canceled') THEN RAISE EXCEPTION 'invalid provider status'; END IF;
  SELECT * INTO result FROM pushinpay_private.operations WHERE id = p_id AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'operation not found'; END IF;
  IF result.provider_id IS NOT NULL AND lower(result.provider_id) <> lower(p_provider_id) THEN RAISE EXCEPTION 'provider conflict'; END IF;
  IF result.status NOT IN ('submitting', 'unknown', 'created', 'paid', 'canceled') OR
     (result.status IN ('paid', 'canceled') AND result.status <> p_status) THEN RAISE EXCEPTION 'invalid status transition'; END IF;
  UPDATE pushinpay_private.operations SET provider_id = COALESCE(provider_id, p_provider_id), status = p_status, updated_at = now()
  WHERE id = p_id RETURNING * INTO result;
  RETURN result;
END $$;

CREATE FUNCTION pushinpay_private.mark_unknown(p_id uuid, p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
BEGIN
  UPDATE pushinpay_private.operations SET status = 'unknown', updated_at = now()
  WHERE id = p_id AND user_id = p_user AND status = 'submitting';
  RETURN FOUND;
END $$;

-- Um worker adquire a consulta antes da chamada à API. Falhas mantêm a reserva
-- pelo intervalo completo, evitando rajadas e repetição simultânea.
CREATE FUNCTION pushinpay_private.claim_verification(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE last_claim timestamptz; claimed_at timestamptz;
BEGIN
  IF p_id IS NULL OR NOT EXISTS (SELECT 1 FROM pushinpay_private.operations WHERE id = p_id AND provider_id IS NOT NULL) THEN
    RETURN false;
  END IF;
  SELECT last_claimed_at INTO last_claim FROM pushinpay_private.verification_limit WHERE singleton FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verification limit missing'; END IF;
  claimed_at := clock_timestamp();
  IF last_claim IS NOT NULL AND last_claim > claimed_at - interval '60 seconds' THEN RETURN false; END IF;
  UPDATE pushinpay_private.verification_limit SET last_claimed_at = claimed_at WHERE singleton;
  RETURN true;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pushinpay_private FROM PUBLIC, anon, authenticated, service_role;

-- A rota do servidor autentica a notificação antes desta RPC. A revisão evita
-- perder um aviso recebido durante o processamento de um aviso anterior.
CREATE FUNCTION public.pushinpay_enqueue_notification(p_provider_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
BEGIN
  IF p_provider_id IS NULL OR p_provider_id !~ '^[A-Za-z0-9-]{1,100}$' THEN RAISE EXCEPTION 'invalid provider identifier'; END IF;
  INSERT INTO pushinpay_private.notifications(provider_id) VALUES (lower(p_provider_id))
  ON CONFLICT (provider_id) DO UPDATE SET revision = pushinpay_private.notifications.revision + 1, received_at = now();
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_enqueue_notification(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_enqueue_notification(text) TO service_role;

-- Recupera cobranças sem aviso, respeitando o limite de consulta na aquisição.
CREATE FUNCTION public.pushinpay_seed_reconciliation()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE target text;
BEGIN
  SELECT o.provider_id INTO target FROM pushinpay_private.operations o
  WHERE o.direction = 'deposit' AND o.status = 'created' AND o.provider_id IS NOT NULL
    AND o.updated_at < now() - interval '2 minutes'
    AND NOT EXISTS (SELECT 1 FROM pushinpay_private.notifications n WHERE n.provider_id = lower(o.provider_id) AND n.revision > n.processed_revision)
  ORDER BY o.updated_at LIMIT 1;
  IF target IS NULL THEN RETURN false; END IF;
  PERFORM public.pushinpay_enqueue_notification(target);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_seed_reconciliation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_seed_reconciliation() TO service_role;

CREATE FUNCTION public.pushinpay_claim_notification(p_lease_id uuid)
RETURNS TABLE(operation_id uuid, user_id uuid, provider_id text, amount_cents bigint, direction text, revision bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE item pushinpay_private.notifications%ROWTYPE; op pushinpay_private.operations%ROWTYPE;
BEGIN
  IF p_lease_id IS NULL THEN RAISE EXCEPTION 'invalid lease'; END IF;
  SELECT n.* INTO item FROM pushinpay_private.notifications n
  JOIN pushinpay_private.operations o ON lower(o.provider_id) = n.provider_id
  WHERE n.revision > n.processed_revision AND (n.leased_until IS NULL OR n.leased_until <= clock_timestamp())
    AND o.direction = 'deposit'
  ORDER BY n.received_at FOR UPDATE OF n SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO op FROM pushinpay_private.operations o WHERE lower(o.provider_id) = item.provider_id;
  IF NOT pushinpay_private.claim_verification(op.id) THEN RETURN; END IF;
  UPDATE pushinpay_private.notifications n SET leased_until = clock_timestamp() + interval '60 seconds', lease_id = p_lease_id WHERE n.provider_id = item.provider_id;
  RETURN QUERY SELECT op.id, op.user_id, op.provider_id, op.amount_cents, op.direction, item.revision;
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_claim_notification(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_claim_notification(uuid) TO service_role;

CREATE FUNCTION public.pushinpay_complete_notification(p_operation_id uuid, p_user_id uuid, p_provider_id text, p_amount_cents bigint, p_revision bigint, p_status text, p_lease_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE item pushinpay_private.notifications%ROWTYPE; op pushinpay_private.operations%ROWTYPE;
BEGIN
  SELECT * INTO item FROM pushinpay_private.notifications n WHERE n.provider_id = lower(p_provider_id) FOR UPDATE;
  IF NOT FOUND OR p_revision IS NULL OR p_revision < 1 OR p_revision > item.revision OR p_lease_id IS NULL OR item.lease_id IS DISTINCT FROM p_lease_id THEN RAISE EXCEPTION 'invalid notification revision or lease'; END IF;
  SELECT * INTO op FROM pushinpay_private.operations o WHERE o.id = p_operation_id AND o.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR op.amount_cents <> p_amount_cents OR lower(op.provider_id) <> lower(p_provider_id) OR op.direction <> 'deposit' THEN RAISE EXCEPTION 'operation mismatch'; END IF;
  PERFORM pushinpay_private.record_provider_status(p_operation_id, p_user_id, p_provider_id, p_status);
  UPDATE pushinpay_private.notifications n SET processed_revision = greatest(n.processed_revision, p_revision), leased_until = NULL, lease_id = NULL WHERE n.provider_id = item.provider_id;
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_complete_notification(uuid, uuid, text, bigint, bigint, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_complete_notification(uuid, uuid, text, bigint, bigint, text, uuid) TO service_role;

-- Wrappers restritos ao servidor. Autenticação e elegibilidade são validadas antes da chamada.
CREATE FUNCTION public.pushinpay_prepare_deposit(p_id uuid, p_user_id uuid, p_amount_cents bigint, p_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE op pushinpay_private.operations%ROWTYPE;
BEGIN
  SELECT * INTO op FROM pushinpay_private.prepare_operation(p_id, p_user_id, 'deposit', p_amount_cents, p_fingerprint);
  RETURN to_jsonb(op);
END $$;

CREATE FUNCTION public.pushinpay_get_deposit(p_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
  SELECT to_jsonb(o) FROM pushinpay_private.operations o WHERE o.id = p_id AND o.user_id = p_user_id AND o.direction = 'deposit'
$$;

CREATE FUNCTION public.pushinpay_claim_deposit(p_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
  SELECT pushinpay_private.claim_submission(p_id, p_user_id)
$$;

CREATE FUNCTION public.pushinpay_save_deposit(p_id uuid, p_user_id uuid, p_provider_id text, p_amount_cents bigint, p_pix_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE op pushinpay_private.operations%ROWTYPE;
BEGIN
  SELECT * INTO op FROM pushinpay_private.record_deposit_created(p_id, p_user_id, p_provider_id, p_amount_cents, p_pix_code);
  RETURN to_jsonb(op);
END $$;

CREATE FUNCTION public.pushinpay_mark_deposit_unknown(p_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
  SELECT pushinpay_private.mark_unknown(p_id, p_user_id)
$$;

-- A reserva usa unidades base de pUSD; a cotação em BRL é fornecida pelo fluxo
-- de conversão validado. A operação e a reserva são gravadas atomicamente.
CREATE FUNCTION pushinpay_private.prepare_withdrawal(p_id uuid, p_user_id uuid, p_amount_cents bigint, p_reserved_pusd bigint, p_fingerprint text)
RETURNS pushinpay_private.operations LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private, shared_wallet_private AS $$
DECLARE op pushinpay_private.operations%ROWTYPE;
BEGIN
  IF p_reserved_pusd IS NULL OR p_reserved_pusd <= 0 THEN RAISE EXCEPTION 'invalid reservation amount'; END IF;
  SELECT * INTO op FROM pushinpay_private.prepare_operation(p_id, p_user_id, 'withdrawal', p_amount_cents, p_fingerprint);
  IF op.reserved_pusd IS NOT NULL AND op.reserved_pusd <> p_reserved_pusd THEN RAISE EXCEPTION 'reservation conflict'; END IF;
  PERFORM shared_wallet_private.reserve(p_user_id, p_id, p_reserved_pusd);
  UPDATE pushinpay_private.operations SET reserved_pusd = p_reserved_pusd, updated_at = now()
  WHERE id = p_id RETURNING * INTO op;
  RETURN op;
END $$;
REVOKE ALL ON FUNCTION pushinpay_private.prepare_withdrawal(uuid, uuid, bigint, bigint, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pushinpay_prepare_deposit(uuid, uuid, bigint, text), public.pushinpay_get_deposit(uuid, uuid), public.pushinpay_claim_deposit(uuid, uuid), public.pushinpay_save_deposit(uuid, uuid, text, bigint, text), public.pushinpay_mark_deposit_unknown(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_prepare_deposit(uuid, uuid, bigint, text), public.pushinpay_get_deposit(uuid, uuid), public.pushinpay_claim_deposit(uuid, uuid), public.pushinpay_save_deposit(uuid, uuid, text, bigint, text), public.pushinpay_mark_deposit_unknown(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
