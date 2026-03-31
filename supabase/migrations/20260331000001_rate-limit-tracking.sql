-- Rate limit tracking table for Edge Functions
-- Replaces in-memory Maps that reset on function restart

CREATE TABLE IF NOT EXISTS public.rate_limit_tracking (
  user_id  uuid NOT NULL,
  action   text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action)
);

-- No RLS needed: only accessible via SECURITY DEFINER function below
ALTER TABLE public.rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- RPC: atomically check and increment rate limit counter
-- Returns TRUE if the request is allowed, FALSE if the limit is exceeded.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id      uuid,
  p_action       text,
  p_max_requests integer DEFAULT 10,
  p_window_secs  integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit_tracking (user_id, action, window_start, request_count)
  VALUES (p_user_id, p_action, now(), 1)
  ON CONFLICT (user_id, action) DO UPDATE
    SET
      window_start  = CASE
        WHEN rate_limit_tracking.window_start < (now() - make_interval(secs => p_window_secs))
          THEN now()
        ELSE rate_limit_tracking.window_start
      END,
      request_count = CASE
        WHEN rate_limit_tracking.window_start < (now() - make_interval(secs => p_window_secs))
          THEN 1
        ELSE rate_limit_tracking.request_count + 1
      END
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

-- Clean up stale rows older than 1 hour (called opportunistically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_tracking
  WHERE window_start < now() - interval '1 hour';
$$;
