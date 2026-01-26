-- Fix ledger_entries direction value to use 'DEBIT' instead of 'OUT'
CREATE OR REPLACE FUNCTION public.atomic_execute_multi_trade(
  p_user_id UUID,
  p_market_id UUID,
  p_option_id UUID,
  p_shares NUMERIC,
  p_max_cost NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_market markets%ROWTYPE;
  v_option market_options%ROWTYPE;
  v_all_options market_options[];
  v_current_shares NUMERIC[];
  v_new_shares NUMERIC[];
  v_old_cost NUMERIC;
  v_new_cost NUMERIC;
  v_trade_cost NUMERIC;
  v_b NUMERIC;
  v_option_index INT;
  v_i INT;
  v_sum_exp_old NUMERIC;
  v_sum_exp_new NUMERIC;
  v_max_val NUMERIC;
  v_price_per_share NUMERIC;
  v_new_prices JSONB;
  v_transaction_id UUID;
  v_contract_id UUID;
  v_ledger_id UUID;
  v_existing_contract user_contracts%ROWTYPE;
  v_total_exp NUMERIC;
BEGIN
  -- Lock wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;
  
  -- Get market
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não encontrado');
  END IF;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não está aberto');
  END IF;
  
  -- Get target option
  SELECT * INTO v_option FROM market_options WHERE id = p_option_id AND market_id = p_market_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opção não encontrada');
  END IF;
  
  -- Get all options for this market (ordered)
  SELECT array_agg(mo ORDER BY display_order) INTO v_all_options
  FROM market_options mo WHERE mo.market_id = p_market_id;
  
  -- Build current shares array and find option index
  v_current_shares := ARRAY[]::NUMERIC[];
  v_option_index := -1;
  FOR v_i IN 1..array_length(v_all_options, 1) LOOP
    v_current_shares := array_append(v_current_shares, v_all_options[v_i].shares);
    IF v_all_options[v_i].id = p_option_id THEN
      v_option_index := v_i;
    END IF;
  END LOOP;
  
  IF v_option_index = -1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Índice de opção inválido');
  END IF;
  
  -- Get LMSR b parameter
  v_b := COALESCE(v_market.lmsr_b, 100);
  
  -- Calculate old cost using log-sum-exp
  v_max_val := v_current_shares[1] / v_b;
  FOR v_i IN 2..array_length(v_current_shares, 1) LOOP
    IF v_current_shares[v_i] / v_b > v_max_val THEN
      v_max_val := v_current_shares[v_i] / v_b;
    END IF;
  END LOOP;
  
  v_sum_exp_old := 0;
  FOR v_i IN 1..array_length(v_current_shares, 1) LOOP
    v_sum_exp_old := v_sum_exp_old + exp(v_current_shares[v_i] / v_b - v_max_val);
  END LOOP;
  v_old_cost := v_b * (v_max_val + ln(v_sum_exp_old));
  
  -- Build new shares array (add shares to selected option)
  v_new_shares := v_current_shares;
  v_new_shares[v_option_index] := v_new_shares[v_option_index] + p_shares;
  
  -- Calculate new cost
  v_max_val := v_new_shares[1] / v_b;
  FOR v_i IN 2..array_length(v_new_shares, 1) LOOP
    IF v_new_shares[v_i] / v_b > v_max_val THEN
      v_max_val := v_new_shares[v_i] / v_b;
    END IF;
  END LOOP;
  
  v_sum_exp_new := 0;
  FOR v_i IN 1..array_length(v_new_shares, 1) LOOP
    v_sum_exp_new := v_sum_exp_new + exp(v_new_shares[v_i] / v_b - v_max_val);
  END LOOP;
  v_new_cost := v_b * (v_max_val + ln(v_sum_exp_new));
  
  -- Trade cost
  v_trade_cost := v_new_cost - v_old_cost;
  v_price_per_share := v_trade_cost / p_shares;
  
  -- Check max cost
  IF v_trade_cost > p_max_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preço excedeu o custo máximo permitido');
  END IF;
  
  -- Check balance
  IF v_wallet.balance_available < v_trade_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente');
  END IF;
  
  -- Deduct from wallet
  UPDATE wallets SET 
    balance_available = balance_available - v_trade_cost,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Create ledger entry - use DEBIT for outgoing funds
  INSERT INTO ledger_entries (
    user_id, wallet_id, ref_type, ref_id, direction, amount, fee_amount, net_amount, platform_revenue, status, meta
  ) VALUES (
    p_user_id, v_wallet.id, 'TRADE', p_market_id, 'DEBIT', v_trade_cost, 0, v_trade_cost, 0, 'COMPLETED',
    jsonb_build_object('option_id', p_option_id, 'option_label', v_option.label, 'shares', p_shares)
  ) RETURNING id INTO v_ledger_id;
  
  -- Transaction record
  INSERT INTO transactions (
    user_id, market_id, option_id, type, position, shares, price_per_share, total_amount
  ) VALUES (
    p_user_id, p_market_id, p_option_id, 'BUY', 'OPTION', p_shares, v_price_per_share, v_trade_cost
  ) RETURNING id INTO v_transaction_id;
  
  -- User contract (upsert)
  SELECT * INTO v_existing_contract FROM user_contracts
  WHERE user_id = p_user_id AND market_id = p_market_id AND option_id = p_option_id;
  
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
      user_id, market_id, option_id, position, shares, average_price, total_invested
    ) VALUES (
      p_user_id, p_market_id, p_option_id, 'OPTION', p_shares, v_price_per_share, v_trade_cost
    ) RETURNING id INTO v_contract_id;
  END IF;
  
  -- Update option shares
  UPDATE market_options SET 
    shares = shares + p_shares,
    updated_at = now()
  WHERE id = p_option_id;
  
  -- Calculate and update new prices for all options
  v_total_exp := 0;
  FOR v_i IN 1..array_length(v_new_shares, 1) LOOP
    v_total_exp := v_total_exp + exp(v_new_shares[v_i] / v_b);
  END LOOP;
  
  v_new_prices := '[]'::jsonb;
  FOR v_i IN 1..array_length(v_all_options, 1) LOOP
    DECLARE
      v_new_price NUMERIC;
    BEGIN
      v_new_price := exp(v_new_shares[v_i] / v_b) / v_total_exp;
      v_new_prices := v_new_prices || jsonb_build_object(
        'id', v_all_options[v_i].id,
        'price', v_new_price
      );
      UPDATE market_options SET current_price = v_new_price WHERE id = v_all_options[v_i].id;
    END;
  END LOOP;
  
  -- Update market volume
  UPDATE markets SET 
    total_volume = total_volume + v_trade_cost,
    updated_at = now()
  WHERE id = p_market_id;
  
  -- Update profile stats
  UPDATE profiles SET
    total_trades = total_trades + 1,
    total_volume = total_volume + v_trade_cost,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'trade_cost', v_trade_cost,
    'price_per_share', v_price_per_share,
    'new_prices', v_new_prices,
    'contract_id', v_contract_id,
    'transaction_id', v_transaction_id,
    'new_balance', v_wallet.balance_available - v_trade_cost
  );
END;
$$;