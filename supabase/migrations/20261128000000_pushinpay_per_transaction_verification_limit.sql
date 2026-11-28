-- Limite de consulta à Pushin Pay passa a valer por transação (1 consulta por minuto
-- para cada operação), em vez de um limite único compartilhado pela conta.
-- Decisão do responsável pelo produto em 2026-11-28; a documentação da Pushin Pay
-- ("Consultas diretas são autorizadas a cada 1 minuto") não esclarece o escopo.
-- A tabela pushinpay_private.verification_limit fica preservada, sem uso, para permitir
-- reverter para o limite global recriando a função anterior.

ALTER TABLE pushinpay_private.operations ADD COLUMN last_verification_at timestamptz;

CREATE OR REPLACE FUNCTION pushinpay_private.claim_verification(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE claimed uuid;
BEGIN
  IF p_id IS NULL THEN RETURN false; END IF;
  -- UPDATE atômico: a trava da linha impede duas instâncias de reservarem a mesma operação.
  UPDATE pushinpay_private.operations
     SET last_verification_at = clock_timestamp()
   WHERE id = p_id AND provider_id IS NOT NULL
     AND (last_verification_at IS NULL OR last_verification_at <= clock_timestamp() - interval '60 seconds')
  RETURNING id INTO claimed;
  RETURN claimed IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION pushinpay_private.claim_verification(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Ignora avisos de operações consultadas há menos de um minuto, para que uma operação
-- em espera não bloqueie as demais da fila.
CREATE OR REPLACE FUNCTION public.pushinpay_claim_notification_v2(p_lease_id uuid, p_include_withdrawals boolean)
RETURNS TABLE(operation_id uuid, user_id uuid, provider_id text, amount_cents bigint, direction text, revision bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE item pushinpay_private.notifications%ROWTYPE; op pushinpay_private.operations%ROWTYPE;
BEGIN
  IF p_lease_id IS NULL THEN RAISE EXCEPTION 'invalid lease'; END IF;
  SELECT n.* INTO item FROM pushinpay_private.notifications n
  JOIN pushinpay_private.operations o ON lower(o.provider_id) = n.provider_id
  WHERE n.revision > n.processed_revision AND (n.leased_until IS NULL OR n.leased_until <= clock_timestamp())
    AND (o.direction = 'deposit' OR (o.direction = 'withdrawal' AND p_include_withdrawals IS TRUE))
    AND (o.last_verification_at IS NULL OR o.last_verification_at <= clock_timestamp() - interval '60 seconds')
  ORDER BY n.received_at FOR UPDATE OF n SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO op FROM pushinpay_private.operations o WHERE lower(o.provider_id) = item.provider_id;
  IF NOT pushinpay_private.claim_verification(op.id) THEN RETURN; END IF;
  UPDATE pushinpay_private.notifications n SET leased_until = clock_timestamp() + interval '60 seconds', lease_id = p_lease_id WHERE n.provider_id = item.provider_id;
  RETURN QUERY SELECT op.id, op.user_id, op.provider_id, op.amount_cents, op.direction, item.revision;
END $$;
REVOKE ALL ON FUNCTION public.pushinpay_claim_notification_v2(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_claim_notification_v2(uuid, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
