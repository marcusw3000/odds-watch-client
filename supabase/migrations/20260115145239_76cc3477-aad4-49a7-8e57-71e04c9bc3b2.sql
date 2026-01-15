-- Complete the user_contracts policies (the view policy already exists)
-- Add service role and admin policies for contracts

-- Service role policies for contracts (for edge functions)
CREATE POLICY "Service role can manage contracts"
ON public.user_contracts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admin policies for contracts
CREATE POLICY "Admins can manage all contracts"
ON public.user_contracts FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));