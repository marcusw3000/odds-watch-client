-- Uma interrupção após o envio não deve permitir uma segunda cobrança.
CREATE FUNCTION public.pushinpay_mark_stalled_deposits_unknown()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pushinpay_private AS $$
DECLARE changed integer;
BEGIN
  UPDATE pushinpay_private.operations
     SET status = 'unknown', updated_at = now()
   WHERE direction = 'deposit' AND status = 'submitting'
     AND provider_id IS NULL AND updated_at < now() - interval '10 minutes';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.pushinpay_mark_stalled_deposits_unknown() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pushinpay_mark_stalled_deposits_unknown() TO service_role;
