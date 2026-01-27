-- =====================================================
-- P0: Schedule auto-expire-markets cron job (every 5 minutes)
-- P1: Fix permissive RLS policies on daily_volume_snapshots
-- =====================================================

-- Schedule auto-expire-markets to run every 5 minutes
SELECT cron.schedule(
  'auto-expire-markets',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nfwxyftsdhgxfrnrvsdo.supabase.co/functions/v1/auto-expire-markets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Also schedule check-economic-events to run every hour for more thorough checks
SELECT cron.schedule(
  'check-economic-events',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nfwxyftsdhgxfrnrvsdo.supabase.co/functions/v1/check-economic-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================
-- Fix RLS policies on daily_volume_snapshots
-- Remove overly permissive policies and restrict to service_role only
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow insert for volume snapshots" ON public.daily_volume_snapshots;
DROP POLICY IF EXISTS "Allow update for volume snapshots" ON public.daily_volume_snapshots;
DROP POLICY IF EXISTS "daily_volume_snapshots_insert_policy" ON public.daily_volume_snapshots;
DROP POLICY IF EXISTS "daily_volume_snapshots_update_policy" ON public.daily_volume_snapshots;

-- Ensure RLS is enabled
ALTER TABLE public.daily_volume_snapshots ENABLE ROW LEVEL SECURITY;

-- Create read-only policy for all authenticated users (read is safe)
CREATE POLICY "Allow authenticated users to read volume snapshots"
ON public.daily_volume_snapshots
FOR SELECT
TO authenticated
USING (true);

-- Note: INSERT/UPDATE operations on daily_volume_snapshots should ONLY happen 
-- through Edge Functions using service_role key, which bypasses RLS.
-- No INSERT/UPDATE policies are created intentionally.