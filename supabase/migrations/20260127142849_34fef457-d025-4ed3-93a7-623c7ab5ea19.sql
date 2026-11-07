-- =====================================================
-- P0: Schedule auto-expire-markets cron job (every 5 minutes)
-- P1: Fix permissive RLS policies on daily_volume_snapshots
-- =====================================================

-- Schedules are optional during a fresh installation: the extensions are
-- enabled separately in the Supabase dashboard before jobs are activated.
DO $cron$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL AND to_regnamespace('net') IS NOT NULL THEN
    PERFORM cron.schedule(
      'auto-expire-markets',
      '*/5 * * * *',
      $request$
      SELECT net.http_post(
        url := 'https://tztqsorbugjhwljbiano.supabase.co/functions/v1/auto-expire-markets',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
      $request$
    );
    PERFORM cron.schedule(
      'check-economic-events',
      '0 * * * *',
      $request$
      SELECT net.http_post(
        url := 'https://tztqsorbugjhwljbiano.supabase.co/functions/v1/check-economic-events',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
      $request$
    );
  END IF;
END;
$cron$;

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
