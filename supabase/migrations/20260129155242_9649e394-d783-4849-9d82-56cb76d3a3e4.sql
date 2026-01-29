-- Drop and recreate atomic_execute_trade function with correct column name
DROP FUNCTION IF EXISTS public.atomic_execute_trade(uuid, uuid, text, numeric, numeric);

CREATE FUNCTION public.atomic_execute_trade(
  p_user_id UUID,
  p_market_id UUID,
  p_outcome TEXT,
  p_shares NUMERIC,
  p_max_cost NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_market RECORD;
  v_current_yes_shares NUMERIC;
  v_current_no_shares NUMERIC;
  v_b NUMERIC;
  v_cost_before NUMERIC;
  v_cost_after NUMERIC;
  v_trade_cost NUMERIC;
  v_new_yes_shares NUMERIC;
  v_new_no_shares NUMERIC;
  v_new_yes_price NUMERIC;
  v_new_no_price NUMERIC;
  v_price_per_share NUMERIC;
  v_transaction_id UUID;
  v_contract_id UUID;
  v_existing_contract RECORD;
  v_fee_amount NUMERIC := 0;
  v_fee_rule RECORD;
  v_referral_discount RECORD;
  v_original_fee NUMERIC;
  v_discount_applied NUMERIC := 0;
BEGIN
  -- Lock wallet for update
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Lock market for update
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
  
  -- Get current shares
  v_current_yes_shares := v_market.yes_shares;
  v_current_no_shares := v_market.no_shares;
  v_b := v_market.lmsr_b;
  
  -- Calculate LMSR cost
  v_cost_before := v_b * ln(exp(v_current_yes_shares / v_b) + exp(v_current_no_shares / v_b));
  
  IF p_outcome = 'YES' THEN
    v_new_yes_shares := v_current_yes_shares + p_shares;
    v_new_no_shares := v_current_no_shares;
  ELSE
    v_new_yes_shares := v_current_yes_shares;
    v_new_no_shares := v_current_no_shares + p_shares;
  END IF;
  
  v_cost_after := v_b * ln(exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_trade_cost := ROUND(v_cost_after - v_cost_before, 2);
  
  -- Calculate price per share
  v_price_per_share := v_trade_cost / p_shares;
  
  -- Check slippage
  IF v_trade_cost > p_max_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price exceeded maximum cost (slippage protection)');
  END IF;
  
  -- Check balance
  IF v_wallet.balance_available < v_trade_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Buscar regra de taxa ativa para TRADE
  SELECT * INTO v_fee_rule
  FROM fee_rules
  WHERE type = 'TRADE' AND is_active = true
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Calcular taxa se houver regra
  IF v_fee_rule IS NOT NULL THEN
    IF v_fee_rule.mode = 'PERCENT' THEN
      v_fee_amount := v_trade_cost * COALESCE(v_fee_rule.percent_value, 0);
    ELSIF v_fee_rule.mode = 'FIXED' THEN
      v_fee_amount := COALESCE(v_fee_rule.flat_value, 0);
    END IF;
    
    -- Aplicar min/max
    IF v_fee_rule.min_fee IS NOT NULL AND v_fee_amount < v_fee_rule.min_fee THEN
      v_fee_amount := v_fee_rule.min_fee;
    END IF;
    IF v_fee_rule.max_fee IS NOT NULL AND v_fee_amount > v_fee_rule.max_fee THEN
      v_fee_amount := v_fee_rule.max_fee;
    END IF;
  END IF;
  
  -- Verificar desconto de indicação
  SELECT * INTO v_referral_discount
  FROM get_active_referral_discount(p_user_id);
  
  IF v_referral_discount IS NOT NULL AND v_referral_discount.has_discount THEN
    v_original_fee := v_fee_amount;
    v_fee_amount := ROUND(v_fee_amount * (1 - v_referral_discount.discount_percent), 2);
    v_discount_applied := v_original_fee - v_fee_amount;
  END IF;
  
  v_fee_amount := ROUND(v_fee_amount, 2);
  
  -- Deduct from wallet (cost + fee)
  UPDATE wallets
  SET balance_available = balance_available - v_trade_cost - v_fee_amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;
  
  -- Update market shares and prices
  v_new_yes_price := exp(v_new_yes_shares / v_b) / (exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_new_no_price := 1 - v_new_yes_price;
  
  UPDATE markets
  SET yes_shares = v_new_yes_shares,
      no_shares = v_new_no_shares,
      current_yes_price = v_new_yes_price,
      current_no_price = v_new_no_price,
      total_volume = total_volume + v_trade_cost,
      updated_at = NOW()
  WHERE id = p_market_id;
  
  -- Record price history
  INSERT INTO market_price_history (market_id, yes_price, no_price, source)
  VALUES (p_market_id, v_new_yes_price, v_new_no_price, 'trade');
  
  -- Create transaction (use 'position' column, not 'outcome')
  INSERT INTO transactions (user_id, market_id, type, position, shares, price_per_share, total_amount)
  VALUES (p_user_id, p_market_id, 'BUY', p_outcome, p_shares, v_price_per_share, v_trade_cost)
  RETURNING id INTO v_transaction_id;
  
  -- Check for existing contract
  SELECT * INTO v_existing_contract
  FROM contracts
  WHERE user_id = p_user_id
    AND market_id = p_market_id
    AND outcome = p_outcome
    AND status = 'ACTIVE'
  FOR UPDATE;
  
  IF FOUND THEN
    -- Update existing contract with weighted average price
    UPDATE contracts
    SET quantity = v_existing_contract.quantity + p_shares,
        price_at_purchase = ROUND(
          ((v_existing_contract.quantity * v_existing_contract.price_at_purchase) + (p_shares * v_price_per_share)) 
          / (v_existing_contract.quantity + p_shares), 4
        ),
        updated_at = NOW()
    WHERE id = v_existing_contract.id
    RETURNING id INTO v_contract_id;
  ELSE
    -- Create new contract
    INSERT INTO contracts (user_id, market_id, outcome, quantity, price_at_purchase, status)
    VALUES (p_user_id, p_market_id, p_outcome, p_shares, v_price_per_share, 'ACTIVE')
    RETURNING id INTO v_contract_id;
  END IF;
  
  -- Processar comissão de indicação (se houver taxa após desconto)
  IF v_fee_amount > 0 THEN
    PERFORM process_referral_commission(p_user_id, v_fee_amount, v_trade_cost, NULL);
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
    'new_balance', v_wallet.balance_available - v_trade_cost - v_fee_amount,
    'fee_amount', v_fee_amount,
    'referral_discount_applied', v_discount_applied
  );
END;
$$;