-- Fix the permissive RLS policy on audit_logs
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Create a more secure INSERT policy that only allows authenticated users to insert their own logs
-- or service role for system logs
CREATE POLICY "Authenticated users can insert own audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);