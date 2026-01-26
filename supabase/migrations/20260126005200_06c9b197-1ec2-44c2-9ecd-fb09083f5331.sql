-- Fix atomic_execute_multi_trade to use correct transactions columns
CREATE OR REPLACE FUNCTION atomic_execute_multi_trade(
  p_user_id uuid,
  p_market_id uuid,
  p_option_id uuid,
  p_shares numeric,
  p_max_cost numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Transaction record (using option_id column instead of metadata)
  INSERT INTO transactions (
    user_id, market_id, option_id, type, position, shares, price_per_share, total_amount
  ) VALUES (
    p_user_id, p_market_id, p_option_id, 'BUY', v_option.label, p_shares, v_price_per_share, v_trade_cost
  ) RETURNING id INTO v_transaction_id;
  
  -- User contract (upsert)
  SELECT * INTO v_existing_contract FROM user_contracts
    WHERE user_id = p_user_id AND market_id = p_market_id AND option_id = p_option_id
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
      user_id, market_id, option_id, position, shares, average_price, total_invested
    ) VALUES (
      p_user_id, p_market_id, p_option_id, v_option.label, p_shares, v_price_per_share, v_trade_cost
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
    'price_per_share', v_price_per_share,
    'contract_id', v_contract_id,
    'transaction_id', v_transaction_id,
    'new_balance', v_wallet.balance_available - v_trade_cost,
    'new_prices', v_new_prices
  );
END;
$$;