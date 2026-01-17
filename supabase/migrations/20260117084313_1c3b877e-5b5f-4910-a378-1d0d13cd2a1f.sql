-- Update atomic_deposit_balance to create ledger entries
CREATE OR REPLACE FUNCTION public.atomic_deposit_balance(p_user_id uuid, p_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_exists BOOLEAN;
  v_wallet_id uuid;
BEGIN
  -- Check if wallet exists
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  v_wallet_exists := v_wallet_id IS NOT NULL;
  
  -- If wallet doesn't exist, create it
  IF NOT v_wallet_exists THEN
    INSERT INTO wallets (user_id, balance_available, total_deposited, currency)
    VALUES (p_user_id, p_amount, p_amount, 'BRL')
    RETURNING id INTO v_wallet_id;
  ELSE
    -- Lock the row atomically and update balance
    UPDATE wallets
    SET 
      balance_available = balance_available + p_amount,
      total_deposited = total_deposited + p_amount,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  
  -- Create ledger entry for deposit
  INSERT INTO ledger_entries (
    user_id,
    wallet_id,
    amount,
    net_amount,
    direction,
    ref_type,
    status
  ) VALUES (
    p_user_id,
    v_wallet_id,
    p_amount,
    p_amount,
    'IN',
    'DEPOSIT',
    'COMPLETED'
  );
  
  RETURN TRUE;
END;
$function$;

-- Update atomic_withdraw_balance to create ledger entries
CREATE OR REPLACE FUNCTION public.atomic_withdraw_balance(p_user_id uuid, p_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
  v_wallet_id uuid;
BEGIN
  -- Lock the wallet row atomically to prevent concurrent access
  SELECT id, balance_available INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has a wallet
  IF v_wallet_id IS NULL THEN
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
  
  -- Create ledger entry for withdrawal
  INSERT INTO ledger_entries (
    user_id,
    wallet_id,
    amount,
    net_amount,
    direction,
    ref_type,
    status
  ) VALUES (
    p_user_id,
    v_wallet_id,
    p_amount,
    p_amount,
    'OUT',
    'WITHDRAWAL',
    'COMPLETED'
  );
  
  RETURN TRUE;
END;
$function$;