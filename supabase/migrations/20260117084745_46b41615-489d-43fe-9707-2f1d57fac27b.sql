-- Fix direction values in all atomic functions to use CREDIT/DEBIT instead of IN/OUT

-- Fix atomic_deposit_balance
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
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  v_wallet_exists := v_wallet_id IS NOT NULL;
  
  IF NOT v_wallet_exists THEN
    INSERT INTO wallets (user_id, balance_available, total_deposited, currency)
    VALUES (p_user_id, p_amount, p_amount, 'BRL')
    RETURNING id INTO v_wallet_id;
  ELSE
    UPDATE wallets
    SET 
      balance_available = balance_available + p_amount,
      total_deposited = total_deposited + p_amount,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, status
  ) VALUES (
    p_user_id, v_wallet_id, p_amount, p_amount, 'CREDIT', 'DEPOSIT', 'COMPLETED'
  );
  
  RETURN TRUE;
END;
$function$;

-- Fix atomic_withdraw_balance
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
    p_user_id, v_wallet_id, p_amount, p_amount, 'DEBIT', 'WITHDRAWAL', 'COMPLETED'
  );
  
  RETURN TRUE;
END;
$function$;

-- Fix atomic_execute_trade (change OUT to DEBIT)
CREATE OR REPLACE FUNCTION public.atomic_execute_trade(p_user_id uuid, p_market_id uuid, p_outcome text, p_shares numeric, p_max_cost numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_market RECORD;
  v_b numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_trade_cost numeric;
  v_new_yes_shares numeric;
  v_new_no_shares numeric;
  v_new_yes_price numeric;
  v_new_no_price numeric;
  v_wallet_id uuid;
  v_contract_id uuid;
  v_transaction_id uuid;
  v_ledger_id uuid;
  v_existing_contract RECORD;
  v_price_per_share numeric;
BEGIN
  SELECT * INTO v_wallet 
  FROM wallets 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  SELECT * INTO v_market 
  FROM markets 
  WHERE id = p_market_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market is not open for trading');
  END IF;
  
  v_b := v_market.lmsr_b;
  v_old_cost := v_b * ln(exp(v_market.yes_shares / v_b) + exp(v_market.no_shares / v_b));
  
  IF p_outcome = 'YES' THEN
    v_new_yes_shares := v_market.yes_shares + p_shares;
    v_new_no_shares := v_market.no_shares;
  ELSE
    v_new_yes_shares := v_market.yes_shares;
    v_new_no_shares := v_market.no_shares + p_shares;
  END IF;
  
  v_new_cost := v_b * ln(exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_trade_cost := v_new_cost - v_old_cost;
  
  IF v_trade_cost > p_max_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price exceeded maximum cost (slippage protection)');
  END IF;
  
  IF v_wallet.balance_available < v_trade_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  v_new_yes_price := exp(v_new_yes_shares / v_b) / (exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_new_no_price := 1 - v_new_yes_price;
  v_price_per_share := v_trade_cost / p_shares;
  
  UPDATE markets SET
    yes_shares = v_new_yes_shares,
    no_shares = v_new_no_shares,
    current_yes_price = v_new_yes_price,
    current_no_price = v_new_no_price,
    total_volume = total_volume + v_trade_cost,
    updated_at = now()
  WHERE id = p_market_id;
  
  UPDATE wallets SET
    balance_available = balance_available - v_trade_cost,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
  ) VALUES (
    p_user_id, v_wallet.id, v_trade_cost, v_trade_cost, 'DEBIT', 'TRADE', p_market_id, 'COMPLETED'
  ) RETURNING id INTO v_ledger_id;
  
  INSERT INTO transactions (
    user_id, market_id, type, position, shares, price_per_share, total_amount
  ) VALUES (
    p_user_id, p_market_id, 'BUY', p_outcome, p_shares, v_price_per_share, v_trade_cost
  ) RETURNING id INTO v_transaction_id;
  
  SELECT * INTO v_existing_contract
  FROM user_contracts
  WHERE user_id = p_user_id AND market_id = p_market_id AND position = p_outcome
  FOR UPDATE;
  
  IF FOUND THEN
    UPDATE user_contracts SET
      shares = v_existing_contract.shares + p_shares,
      total_invested = v_existing_contract.total_invested + v_trade_cost,
      average_price = (v_existing_contract.total_invested + v_trade_cost) / (v_existing_contract.shares + p_shares),
      updated_at = now()
    WHERE id = v_existing_contract.id
    RETURNING id INTO v_contract_id;
  ELSE
    INSERT INTO user_contracts (
      user_id, market_id, position, shares, average_price, total_invested
    ) VALUES (
      p_user_id, p_market_id, p_outcome, p_shares, v_price_per_share, v_trade_cost
    ) RETURNING id INTO v_contract_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'trade_cost', v_trade_cost,
    'shares', p_shares,
    'price_per_share', v_price_per_share,
    'new_yes_price', v_new_yes_price,
    'new_no_price', v_new_no_price,
    'transaction_id', v_transaction_id,
    'contract_id', v_contract_id,
    'new_balance', v_wallet.balance_available - v_trade_cost
  );
END;
$function$;

-- Fix atomic_execute_sell (change IN to CREDIT)
CREATE OR REPLACE FUNCTION public.atomic_execute_sell(p_user_id uuid, p_contract_id uuid, p_shares numeric, p_min_value numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_market RECORD;
  v_contract RECORD;
  v_b numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_sell_value numeric;
  v_new_yes_shares numeric;
  v_new_no_shares numeric;
  v_new_yes_price numeric;
  v_new_no_price numeric;
  v_transaction_id uuid;
  v_ledger_id uuid;
  v_price_per_share numeric;
BEGIN
  SELECT * INTO v_contract
  FROM user_contracts
  WHERE id = p_contract_id AND user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.shares < p_shares THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient shares');
  END IF;
  
  SELECT * INTO v_wallet 
  FROM wallets 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  SELECT * INTO v_market 
  FROM markets 
  WHERE id = v_contract.market_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market is not open for trading');
  END IF;
  
  v_b := v_market.lmsr_b;
  v_old_cost := v_b * ln(exp(v_market.yes_shares / v_b) + exp(v_market.no_shares / v_b));
  
  IF v_contract.position = 'YES' THEN
    v_new_yes_shares := v_market.yes_shares - p_shares;
    v_new_no_shares := v_market.no_shares;
  ELSE
    v_new_yes_shares := v_market.yes_shares;
    v_new_no_shares := v_market.no_shares - p_shares;
  END IF;
  
  v_new_cost := v_b * ln(exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_sell_value := v_old_cost - v_new_cost;
  
  IF v_sell_value < p_min_value THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price below minimum value (slippage protection)');
  END IF;
  
  v_new_yes_price := exp(v_new_yes_shares / v_b) / (exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_new_no_price := 1 - v_new_yes_price;
  v_price_per_share := v_sell_value / p_shares;
  
  UPDATE markets SET
    yes_shares = v_new_yes_shares,
    no_shares = v_new_no_shares,
    current_yes_price = v_new_yes_price,
    current_no_price = v_new_no_price,
    updated_at = now()
  WHERE id = v_contract.market_id;
  
  UPDATE wallets SET
    balance_available = balance_available + v_sell_value,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
  ) VALUES (
    p_user_id, v_wallet.id, v_sell_value, v_sell_value, 'CREDIT', 'TRADE', v_contract.market_id, 'COMPLETED'
  ) RETURNING id INTO v_ledger_id;
  
  INSERT INTO transactions (
    user_id, market_id, type, position, shares, price_per_share, total_amount
  ) VALUES (
    p_user_id, v_contract.market_id, 'SELL', v_contract.position, p_shares, v_price_per_share, v_sell_value
  ) RETURNING id INTO v_transaction_id;
  
  IF v_contract.shares = p_shares THEN
    DELETE FROM user_contracts WHERE id = p_contract_id;
  ELSE
    UPDATE user_contracts SET
      shares = shares - p_shares,
      total_invested = total_invested - (v_contract.average_price * p_shares),
      updated_at = now()
    WHERE id = p_contract_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'sell_value', v_sell_value,
    'shares', p_shares,
    'price_per_share', v_price_per_share,
    'new_yes_price', v_new_yes_price,
    'new_no_price', v_new_no_price,
    'transaction_id', v_transaction_id,
    'new_balance', v_wallet.balance_available + v_sell_value
  );
END;
$function$;