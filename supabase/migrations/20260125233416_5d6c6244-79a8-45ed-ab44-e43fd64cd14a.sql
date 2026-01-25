-- Helper: calculate_multi_lmsr_cost
-- Calcula o custo total do estado LMSR para N opções usando log-sum-exp trick
CREATE OR REPLACE FUNCTION public.calculate_multi_lmsr_cost(shares numeric[], b numeric)
RETURNS numeric AS $$
DECLARE
  max_val numeric;
  sum_exp numeric := 0;
  i integer;
BEGIN
  IF array_length(shares, 1) IS NULL OR array_length(shares, 1) = 0 THEN
    RETURN 0;
  END IF;
  
  -- Find max scaled value for numerical stability
  max_val := shares[1] / b;
  FOR i IN 2..array_length(shares, 1) LOOP
    IF shares[i] / b > max_val THEN
      max_val := shares[i] / b;
    END IF;
  END LOOP;
  
  -- Calculate sum of exp with stability trick
  FOR i IN 1..array_length(shares, 1) LOOP
    sum_exp := sum_exp + exp((shares[i] / b) - max_val);
  END LOOP;
  
  RETURN b * (max_val + ln(sum_exp));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper: calculate_multi_lmsr_prices
-- Retorna array de preços (0-100) para cada opção
CREATE OR REPLACE FUNCTION public.calculate_multi_lmsr_prices(shares numeric[], b numeric)
RETURNS numeric[] AS $$
DECLARE
  max_val numeric;
  exp_values numeric[];
  sum_exp numeric := 0;
  prices numeric[];
  i integer;
BEGIN
  IF array_length(shares, 1) IS NULL OR array_length(shares, 1) = 0 THEN
    RETURN ARRAY[]::numeric[];
  END IF;
  
  -- Find max scaled value
  max_val := shares[1] / b;
  FOR i IN 2..array_length(shares, 1) LOOP
    IF shares[i] / b > max_val THEN
      max_val := shares[i] / b;
    END IF;
  END LOOP;
  
  -- Calculate exp values with stability
  FOR i IN 1..array_length(shares, 1) LOOP
    exp_values[i] := exp((shares[i] / b) - max_val);
    sum_exp := sum_exp + exp_values[i];
  END LOOP;
  
  -- Calculate prices as percentages (1-99 clamped)
  FOR i IN 1..array_length(shares, 1) LOOP
    prices[i] := LEAST(99, GREATEST(1, round((exp_values[i] / sum_exp) * 100)));
  END LOOP;
  
  RETURN prices;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function: atomic_execute_multi_trade
-- Executa trade em mercado multi-opção atomicamente
CREATE OR REPLACE FUNCTION public.atomic_execute_multi_trade(
  p_user_id uuid, 
  p_market_id uuid, 
  p_option_id uuid,
  p_shares numeric, 
  p_max_cost numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
  v_market RECORD;
  v_option RECORD;
  v_b numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_trade_cost numeric;
  v_all_shares numeric[];
  v_new_shares numeric[];
  v_new_prices numeric[];
  v_option_index integer;
  v_price_per_share numeric;
  v_contract_id uuid;
  v_transaction_id uuid;
  v_ledger_id uuid;
  v_existing_contract RECORD;
  v_option_record RECORD;
  v_idx integer := 1;
BEGIN
  -- Validate shares
  IF p_shares <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;
  
  -- Lock market
  SELECT * INTO v_market FROM markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não encontrado');
  END IF;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não está aberto');
  END IF;
  
  IF v_market.market_type != 'MULTIPLE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não é multi-opção');
  END IF;
  
  v_b := v_market.lmsr_b;
  
  -- Build shares array and find option index
  v_option_index := NULL;
  FOR v_option_record IN 
    SELECT id, shares FROM market_options 
    WHERE market_id = p_market_id 
    ORDER BY display_order
  LOOP
    v_all_shares[v_idx] := v_option_record.shares;
    IF v_option_record.id = p_option_id THEN
      v_option_index := v_idx;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;
  
  IF v_option_index IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opção não encontrada');
  END IF;
  
  -- Get option details
  SELECT * INTO v_option FROM market_options WHERE id = p_option_id FOR UPDATE;
  
  -- Calculate LMSR cost
  v_old_cost := calculate_multi_lmsr_cost(v_all_shares, v_b);
  
  v_new_shares := v_all_shares;
  v_new_shares[v_option_index] := v_new_shares[v_option_index] + p_shares;
  
  v_new_cost := calculate_multi_lmsr_cost(v_new_shares, v_b);
  v_trade_cost := v_new_cost - v_old_cost;
  
  -- Slippage check
  IF v_trade_cost > p_max_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preço excedeu o custo máximo permitido');
  END IF;
  
  -- Balance check
  IF v_wallet.balance_available < v_trade_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente');
  END IF;
  
  v_price_per_share := v_trade_cost / p_shares;
  
  -- Calculate new prices for all options
  v_new_prices := calculate_multi_lmsr_prices(v_new_shares, v_b);
  
  -- Update all options with new shares and prices
  v_idx := 1;
  FOR v_option_record IN 
    SELECT id FROM market_options 
    WHERE market_id = p_market_id 
    ORDER BY display_order
  LOOP
    UPDATE market_options SET
      shares = v_new_shares[v_idx],
      current_price = v_new_prices[v_idx],
      updated_at = now()
    WHERE id = v_option_record.id;
    v_idx := v_idx + 1;
  END LOOP;
  
  -- Update market total volume
  UPDATE markets SET
    total_volume = total_volume + v_trade_cost,
    updated_at = now()
  WHERE id = p_market_id;
  
  -- Deduct from wallet
  UPDATE wallets SET
    balance_available = balance_available - v_trade_cost,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Ledger entry
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status,
    meta
  ) VALUES (
    p_user_id, v_wallet.id, v_trade_cost, v_trade_cost, 'DEBIT', 'TRADE', p_market_id, 'COMPLETED',
    jsonb_build_object('option_id', p_option_id, 'option_label', v_option.label, 'shares', p_shares)
  ) RETURNING id INTO v_ledger_id;
  
  -- Transaction record
  INSERT INTO transactions (
    user_id, market_id, type, position, shares, price_per_share, total_amount, 
    metadata, status
  ) VALUES (
    p_user_id, p_market_id, 'BUY', v_option.label, p_shares, v_price_per_share, v_trade_cost,
    jsonb_build_object('option_id', p_option_id, 'option_label', v_option.label, 'market_type', 'MULTIPLE'),
    'COMPLETED'
  ) RETURNING id INTO v_transaction_id;
  
  -- Update or create user contract
  SELECT * INTO v_existing_contract
  FROM user_contracts
  WHERE user_id = p_user_id AND market_id = p_market_id AND position = v_option.label
  FOR UPDATE;
  
  IF FOUND THEN
    UPDATE user_contracts SET
      shares = v_existing_contract.shares + p_shares,
      avg_price = (
        (v_existing_contract.avg_price * v_existing_contract.shares) + 
        (v_price_per_share * p_shares)
      ) / (v_existing_contract.shares + p_shares),
      updated_at = now()
    WHERE id = v_existing_contract.id
    RETURNING id INTO v_contract_id;
  ELSE
    INSERT INTO user_contracts (
      user_id, market_id, position, shares, avg_price, status
    ) VALUES (
      p_user_id, p_market_id, v_option.label, p_shares, v_price_per_share, 'ACTIVE'
    ) RETURNING id INTO v_contract_id;
  END IF;
  
  -- Update profile stats
  UPDATE profiles SET
    total_trades = total_trades + 1,
    total_volume = total_volume + v_trade_cost,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'trade_cost', v_trade_cost,
    'shares', p_shares,
    'price_per_share', v_price_per_share,
    'new_prices', v_new_prices,
    'transaction_id', v_transaction_id,
    'contract_id', v_contract_id,
    'new_balance', v_wallet.balance_available - v_trade_cost
  );
END;
$$;