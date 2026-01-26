-- Create atomic_execute_multi_sell function for multi-option markets
CREATE OR REPLACE FUNCTION public.atomic_execute_multi_sell(
  p_user_id UUID,
  p_contract_id UUID,
  p_shares NUMERIC,
  p_min_value NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_market RECORD;
  v_option RECORD;
  v_wallet RECORD;
  v_all_options RECORD;
  v_b NUMERIC;
  v_old_cost NUMERIC;
  v_new_cost NUMERIC;
  v_sell_value NUMERIC;
  v_price_per_share NUMERIC;
  v_new_prices JSONB;
  v_max_scaled NUMERIC;
  v_sum_exp_old NUMERIC;
  v_sum_exp_new NUMERIC;
  v_transaction_id UUID;
  v_ledger_id UUID;
  v_shares_array NUMERIC[];
  v_new_shares_array NUMERIC[];
  v_option_ids UUID[];
  v_option_index INT;
  v_i INT;
BEGIN
  -- Lock and get contract
  SELECT uc.*, mo.id as mo_id, mo.shares as option_shares, mo.market_id as mo_market_id
  INTO v_contract
  FROM user_contracts uc
  LEFT JOIN market_options mo ON mo.id = uc.option_id
  WHERE uc.id = p_contract_id
    AND uc.user_id = p_user_id
  FOR UPDATE OF uc;

  IF v_contract IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;

  IF v_contract.position != 'OPTION' OR v_contract.option_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a multi-option contract');
  END IF;

  IF v_contract.shares < p_shares THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient shares');
  END IF;

  -- Get market with lock
  SELECT * INTO v_market
  FROM markets
  WHERE id = v_contract.market_id
  FOR UPDATE;

  IF v_market IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;

  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market is not open for trading');
  END IF;

  -- Get wallet with lock
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_b := COALESCE(v_market.lmsr_b, 100);

  -- Get all options for this market ordered by display_order
  SELECT 
    array_agg(id ORDER BY display_order),
    array_agg(shares ORDER BY display_order)
  INTO v_option_ids, v_shares_array
  FROM market_options
  WHERE market_id = v_contract.market_id;

  -- Find index of our option
  v_option_index := NULL;
  FOR v_i IN 1..array_length(v_option_ids, 1) LOOP
    IF v_option_ids[v_i] = v_contract.option_id THEN
      v_option_index := v_i;
      EXIT;
    END IF;
  END LOOP;

  IF v_option_index IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Option not found in market');
  END IF;

  -- Calculate old cost using log-sum-exp trick
  v_max_scaled := v_shares_array[1] / v_b;
  FOR v_i IN 2..array_length(v_shares_array, 1) LOOP
    IF v_shares_array[v_i] / v_b > v_max_scaled THEN
      v_max_scaled := v_shares_array[v_i] / v_b;
    END IF;
  END LOOP;

  v_sum_exp_old := 0;
  FOR v_i IN 1..array_length(v_shares_array, 1) LOOP
    v_sum_exp_old := v_sum_exp_old + exp(v_shares_array[v_i] / v_b - v_max_scaled);
  END LOOP;
  v_old_cost := v_b * (v_max_scaled + ln(v_sum_exp_old));

  -- Create new shares array with decreased shares for sold option
  v_new_shares_array := v_shares_array;
  v_new_shares_array[v_option_index] := GREATEST(0, v_shares_array[v_option_index] - p_shares);

  -- Calculate new cost
  v_max_scaled := v_new_shares_array[1] / v_b;
  FOR v_i IN 2..array_length(v_new_shares_array, 1) LOOP
    IF v_new_shares_array[v_i] / v_b > v_max_scaled THEN
      v_max_scaled := v_new_shares_array[v_i] / v_b;
    END IF;
  END LOOP;

  v_sum_exp_new := 0;
  FOR v_i IN 1..array_length(v_new_shares_array, 1) LOOP
    v_sum_exp_new := v_sum_exp_new + exp(v_new_shares_array[v_i] / v_b - v_max_scaled);
  END LOOP;
  v_new_cost := v_b * (v_max_scaled + ln(v_sum_exp_new));

  -- Sell value is the difference (old - new since we're removing shares)
  v_sell_value := v_old_cost - v_new_cost;
  v_price_per_share := v_sell_value / p_shares;

  -- Check slippage protection
  IF v_sell_value < p_min_value THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price below minimum value (slippage protection)');
  END IF;

  -- Update the option shares
  UPDATE market_options
  SET shares = v_new_shares_array[v_option_index],
      updated_at = now()
  WHERE id = v_contract.option_id;

  -- Calculate and update new prices for all options
  v_new_prices := '[]'::jsonb;
  FOR v_i IN 1..array_length(v_option_ids, 1) LOOP
    DECLARE
      v_option_price NUMERIC;
      v_exp_val NUMERIC;
    BEGIN
      v_exp_val := exp(v_new_shares_array[v_i] / v_b - v_max_scaled);
      v_option_price := LEAST(99, GREATEST(1, ROUND((v_exp_val / v_sum_exp_new) * 100)));
      
      UPDATE market_options
      SET current_price = v_option_price,
          updated_at = now()
      WHERE id = v_option_ids[v_i];
      
      v_new_prices := v_new_prices || jsonb_build_object('id', v_option_ids[v_i], 'price', v_option_price);
    END;
  END LOOP;

  -- Update user contract
  IF v_contract.shares = p_shares THEN
    -- Delete contract if selling all shares
    DELETE FROM user_contracts WHERE id = p_contract_id;
  ELSE
    -- Update shares count
    UPDATE user_contracts
    SET shares = shares - p_shares,
        updated_at = now()
    WHERE id = p_contract_id;
  END IF;

  -- Credit wallet
  UPDATE wallets
  SET balance = balance + v_sell_value,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Create ledger entry
  INSERT INTO ledger_entries (
    user_id, wallet_id, ref_type, ref_id, direction, 
    amount, fee_amount, net_amount, platform_revenue, status
  ) VALUES (
    p_user_id, v_wallet.id, 'MULTI_SELL', p_contract_id, 'IN',
    v_sell_value, 0, v_sell_value, 0, 'COMPLETED'
  ) RETURNING id INTO v_ledger_id;

  -- Create transaction record
  INSERT INTO transactions (
    user_id, market_id, type, outcome, shares, price, amount, status
  ) VALUES (
    p_user_id, v_contract.market_id, 'SELL', 'OPTION', p_shares, 
    v_price_per_share, v_sell_value, 'COMPLETED'
  ) RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'sell_value', v_sell_value,
    'shares', p_shares,
    'price_per_share', v_price_per_share,
    'new_prices', v_new_prices,
    'transaction_id', v_transaction_id,
    'new_balance', v_wallet.balance + v_sell_value
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'atomic_execute_multi_sell error: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;