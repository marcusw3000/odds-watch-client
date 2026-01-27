-- P2.7: Create atomic batch trade function for NO trades in multi-option markets
-- Buying "NO" on option X = buying "YES" on all other options proportionally

CREATE OR REPLACE FUNCTION atomic_execute_multi_trade_batch(
  p_user_id UUID,
  p_market_id UUID,
  p_exclude_option_id UUID,  -- The option to exclude (user bet NO on this)
  p_total_cost NUMERIC,      -- Total amount to spend
  p_max_slippage NUMERIC DEFAULT 0.05
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_market markets%ROWTYPE;
  v_all_options market_options[];
  v_other_options market_options[];
  v_opt market_options;
  v_total_price NUMERIC := 0;
  v_results JSONB := '[]'::JSONB;
  v_trade_result JSONB;
  v_shares_to_buy NUMERIC;
  v_allocation NUMERIC;
  v_actual_total_cost NUMERIC := 0;
  v_i INT;
  v_b NUMERIC;
  v_current_shares NUMERIC[];
  v_option_index INT;
  v_old_cost NUMERIC;
  v_new_cost NUMERIC;
  v_trade_cost NUMERIC;
  v_max_val NUMERIC;
  v_sum_exp NUMERIC;
BEGIN
  -- Lock wallet first
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;
  
  -- Check balance upfront
  IF v_wallet.balance_available < p_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente');
  END IF;
  
  -- Get market
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não encontrado');
  END IF;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não está aberto para negociação');
  END IF;
  
  IF v_market.market_type != 'MULTIPLE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este mercado não suporta múltiplas opções');
  END IF;
  
  v_b := COALESCE(v_market.lmsr_b, 100);
  
  -- Get all options for this market
  SELECT array_agg(mo ORDER BY display_order) INTO v_all_options
  FROM market_options mo WHERE mo.market_id = p_market_id;
  
  IF v_all_options IS NULL OR array_length(v_all_options, 1) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado precisa ter pelo menos 2 opções');
  END IF;
  
  -- Filter out excluded option and calculate total price of other options
  v_other_options := ARRAY[]::market_options[];
  FOR v_i IN 1..array_length(v_all_options, 1) LOOP
    IF v_all_options[v_i].id != p_exclude_option_id THEN
      v_other_options := array_append(v_other_options, v_all_options[v_i]);
      v_total_price := v_total_price + v_all_options[v_i].current_price;
    END IF;
  END LOOP;
  
  IF array_length(v_other_options, 1) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma opção disponível para compra');
  END IF;
  
  -- Execute trades for each other option proportionally
  FOR v_i IN 1..array_length(v_other_options, 1) LOOP
    v_opt := v_other_options[v_i];
    
    -- Calculate allocation based on current price proportion
    v_allocation := p_total_cost * (v_opt.current_price / v_total_price);
    
    -- Skip very small allocations
    IF v_allocation < 0.01 THEN
      CONTINUE;
    END IF;
    
    -- Use existing atomic_execute_multi_trade function for each option
    -- This handles all LMSR calculations, wallet updates, contracts, etc.
    SELECT atomic_execute_multi_trade(
      p_user_id,
      p_market_id,
      v_opt.id,
      v_allocation / (v_opt.current_price / 100),  -- Convert cost to approximate shares
      v_allocation * (1 + p_max_slippage)  -- Max cost with slippage
    ) INTO v_trade_result;
    
    IF v_trade_result->>'success' = 'true' THEN
      v_actual_total_cost := v_actual_total_cost + (v_trade_result->>'trade_cost')::NUMERIC;
      v_results := v_results || jsonb_build_object(
        'option_id', v_opt.id,
        'option_label', v_opt.label,
        'shares', (v_trade_result->>'shares')::NUMERIC,
        'cost', (v_trade_result->>'trade_cost')::NUMERIC,
        'contract_id', v_trade_result->>'contract_id'
      );
    ELSE
      -- If any trade fails, we need to rollback (transaction will be aborted)
      RAISE EXCEPTION 'Falha ao comprar opção %: %', v_opt.label, v_trade_result->>'error';
    END IF;
  END LOOP;
  
  -- Get updated balance
  SELECT balance_available INTO v_wallet.balance_available 
  FROM wallets WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'contracts', v_results,
    'total_cost', v_actual_total_cost,
    'new_balance', v_wallet.balance_available,
    'excluded_option_id', p_exclude_option_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'error', SQLERRM
  );
END;
$$;