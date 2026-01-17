-- Fix atomic_withdraw_balance to use the correct wallets table
CREATE OR REPLACE FUNCTION public.atomic_withdraw_balance(p_user_id uuid, p_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
BEGIN
  -- Lock the wallet row atomically to prevent concurrent access
  SELECT balance_available INTO v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has a wallet
  IF v_current_balance IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct balance atomically in same transaction
  UPDATE wallets
  SET balance_available = balance_available - p_amount,
      total_withdrawn = total_withdrawn + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$function$;