-- Fix atomic_withdraw_balance function to use correct ref_type value
CREATE OR REPLACE FUNCTION public.atomic_withdraw_balance(p_user_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_wallet_id uuid;
BEGIN
  SELECT id, balance_available INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  UPDATE wallets
  SET balance_available = balance_available - p_amount,
      total_withdrawn = total_withdrawn + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, status
  ) VALUES (
    p_user_id, v_wallet_id, p_amount, p_amount, 'DEBIT', 'WITHDRAW', 'COMPLETED'
  );
  
  RETURN TRUE;
END;
$$;