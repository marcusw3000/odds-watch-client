-- 1. user_achievements: Remove INSERT policy for authenticated users
DROP POLICY IF EXISTS "System can grant achievements" ON public.user_achievements;

-- 2. referral_commissions: Remove INSERT policy for authenticated users
DROP POLICY IF EXISTS "System can insert commissions" ON public.referral_commissions;

-- 3. payments: Restrict INSERT to enforce status=PENDING and fee=0
DROP POLICY IF EXISTS "Users can create own payments" ON public.payments;
CREATE POLICY "Users can create own payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'PENDING'
    AND fee = 0
  );

-- 4. audit_logs: Require non-null user_id matching auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert own audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert own audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);