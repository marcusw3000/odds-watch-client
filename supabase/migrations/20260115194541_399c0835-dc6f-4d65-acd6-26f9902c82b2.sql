-- =============================================================
-- CRITICAL SECURITY FIX: Remove dangerous user_balances policy
-- and fix withdrawal race condition
-- =============================================================

-- 1. Drop the dangerous policy that allows users to modify their own balance
DROP POLICY IF EXISTS "Users can manage own balance" ON user_balances;

-- 2. Add admin-only policy for balance management
CREATE POLICY "Admins can manage all balances"
ON user_balances FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Create atomic withdrawal function to prevent race conditions
CREATE OR REPLACE FUNCTION atomic_withdraw_balance(
  p_user_id UUID,
  p_amount NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  -- Lock the row atomically to prevent concurrent access
  SELECT balance INTO v_current_balance
  FROM user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;  -- Row-level lock prevents race condition
  
  -- Check if user has sufficient balance
  IF v_current_balance IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct balance atomically in same transaction
  UPDATE user_balances
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users (needed for edge functions)
GRANT EXECUTE ON FUNCTION atomic_withdraw_balance(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION atomic_withdraw_balance(UUID, NUMERIC) TO service_role;