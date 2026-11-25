CREATE TABLE public.support_ticket_email_queue (
  ticket_id uuid PRIMARY KEY REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_id uuid,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  last_error text
);

ALTER TABLE public.support_ticket_email_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_ticket_email_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.support_ticket_email_queue TO service_role;

CREATE FUNCTION public.queue_support_ticket_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.support_ticket_email_queue (ticket_id, subject)
  VALUES (NEW.id, NEW.subject);
  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_support_ticket_email
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.queue_support_ticket_email();

CREATE FUNCTION public.claim_support_ticket_emails()
RETURNS TABLE (ticket_id uuid, subject text, lease_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH selected AS (
    SELECT q.ticket_id FROM public.support_ticket_email_queue q
    WHERE q.sent_at IS NULL AND q.next_attempt_at <= now()
      AND (q.lease_until IS NULL OR q.lease_until < now())
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 10
  )
  UPDATE public.support_ticket_email_queue q
  SET lease_id = gen_random_uuid(), lease_until = now() + interval '2 minutes',
      attempts = q.attempts + 1
  FROM selected
  WHERE q.ticket_id = selected.ticket_id
  RETURNING q.ticket_id, q.subject, q.lease_id;
$$;

REVOKE ALL ON FUNCTION public.claim_support_ticket_emails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_support_ticket_emails() TO service_role;

DO $setup$
BEGIN
  IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL OR to_regnamespace('vault') IS NULL THEN
    RAISE EXCEPTION 'Scheduler extensions unavailable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'polymarket_project_url')
    OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'paper_copy_gateway_jwt')
    OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'paper_copy_worker_secret') THEN
    RAISE EXCEPTION 'Scheduler secrets unavailable';
  END IF;
  PERFORM cron.schedule('notify-support-tickets', '* * * * *', $request$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'polymarket_project_url') || '/functions/v1/notify-support-tickets',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'paper_copy_gateway_jwt'),
        'x-copy-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'paper_copy_worker_secret')
      ),
      body := '{}'::jsonb
    ) WHERE EXISTS (
      SELECT 1 FROM public.support_ticket_email_queue
      WHERE sent_at IS NULL AND next_attempt_at <= now()
        AND (lease_until IS NULL OR lease_until < now())
    );
  $request$);
END
$setup$;
