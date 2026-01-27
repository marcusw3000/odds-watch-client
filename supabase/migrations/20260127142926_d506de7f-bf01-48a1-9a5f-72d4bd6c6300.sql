-- Fix remaining permissive RLS policies on daily_volume_snapshots
-- The INSERT/UPDATE policies with USING(true) need to be removed

-- Drop the old permissive policies that were not removed
DROP POLICY IF EXISTS "Service role can insert snapshots" ON public.daily_volume_snapshots;
DROP POLICY IF EXISTS "Service role can update snapshots" ON public.daily_volume_snapshots;

-- Also drop any other permissive policies that might exist
DROP POLICY IF EXISTS "Allow authenticated users to read volume snapshots" ON public.daily_volume_snapshots;

-- Create a single SELECT policy for admins only (using has_role function)
CREATE POLICY "Admins can read volume snapshots"
ON public.daily_volume_snapshots
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Note: No INSERT/UPDATE/DELETE policies needed - service_role bypasses RLS