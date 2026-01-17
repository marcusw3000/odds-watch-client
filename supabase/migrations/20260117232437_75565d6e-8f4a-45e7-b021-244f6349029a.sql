-- Fix: Remove direct user SELECT access to payments table
-- Users should only access payments via payments_safe view which excludes sensitive fields
-- The view already has security_invoker=true and the frontend already uses payments_safe

-- Drop the policy that allows users to directly select from payments table
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;

-- Create a new restrictive policy - only service_role and admins can SELECT directly
-- Regular users must use payments_safe view
CREATE POLICY "Direct payments select admin only"
ON public.payments FOR SELECT
USING (has_role(auth.uid(), 'admin'));