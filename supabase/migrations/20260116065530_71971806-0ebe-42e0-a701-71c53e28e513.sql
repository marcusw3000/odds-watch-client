-- Create atomic_deposit_balance function (similar to atomic_withdraw_balance but for deposits)
CREATE OR REPLACE FUNCTION public.atomic_deposit_balance(p_user_id uuid, p_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_exists BOOLEAN;
BEGIN
  -- Check if wallet exists
  SELECT EXISTS(SELECT 1 FROM wallets WHERE user_id = p_user_id) INTO v_wallet_exists;
  
  -- If wallet doesn't exist, create it
  IF NOT v_wallet_exists THEN
    INSERT INTO wallets (user_id, balance_available, total_deposited, currency)
    VALUES (p_user_id, p_amount, p_amount, 'BRL');
    RETURN TRUE;
  END IF;
  
  -- Lock the row atomically and update balance
  UPDATE wallets
  SET 
    balance_available = balance_available + p_amount,
    total_deposited = total_deposited + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$function$;