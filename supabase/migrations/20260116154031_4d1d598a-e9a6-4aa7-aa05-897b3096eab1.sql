-- Drop the overly permissive update policy that allows any authenticated user to update payments
DROP POLICY IF EXISTS "System can update payments" ON public.payments;

-- Create a new restrictive update policy that only allows admins to update payments
-- Service role connections bypass RLS entirely, so edge functions using service role will still work
CREATE POLICY "Only admins can update payments"
ON public.payments
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));