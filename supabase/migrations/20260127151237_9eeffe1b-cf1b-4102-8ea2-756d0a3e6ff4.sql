-- Fix atomic_execute_multi_trade_batch to handle cumulative price impact
CREATE OR REPLACE FUNCTION atomic_execute_multi_trade_batch(
  p_user_id UUID,
  p_market_id UUID,
  p_exclude_option_id UUID,
  p_total_cost NUMERIC,
  p_max_slippage NUMERIC DEFAULT 0.05
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_allocation NUMERIC;
  v_actual_total_cost NUMERIC := 0;
  v_i INT;
  v_b NUMERIC;
  v_shares_estimate NUMERIC;
  v_remaining_budget NUMERIC;
  v_option_max_cost NUMERIC;
BEGIN
  -- Lock wallet first
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;
  
  -- Check balance upfront with slippage buffer for total
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
  
  -- Get all options for this market (with FRESH data for each trade)
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
  
  -- Track remaining budget to handle cumulative impact
  v_remaining_budget := p_total_cost * (1 + p_max_slippage);
  
  -- Execute trades for each other option proportionally
  FOR v_i IN 1..array_length(v_other_options, 1) LOOP
    v_opt := v_other_options[v_i];
    
    -- Calculate allocation based on current price proportion
    v_allocation := p_total_cost * (v_opt.current_price / v_total_price);
    
    -- Skip very small allocations
    IF v_allocation < 0.01 THEN
      CONTINUE;
    END IF;
    
    -- Estimate shares: cost / (price/100) with a small buffer for LMSR curve
    -- Price is in cents (0-100), so divide by 100 to get decimal
    v_shares_estimate := v_allocation / GREATEST(v_opt.current_price / 100, 0.01);
    
    -- For batch trades, we need MORE slippage tolerance per option because:
    -- 1. Each trade moves the market
    -- 2. Subsequent trades see different prices
    -- Use 20% per-option slippage for batch operations, or remaining budget
    v_option_max_cost := LEAST(
      v_allocation * (1 + 0.20),  -- 20% slippage per option
      v_remaining_budget          -- Don't exceed remaining budget
    );
    
    -- Use existing atomic_execute_multi_trade function for each option
    SELECT atomic_execute_multi_trade(
      p_user_id,
      p_market_id,
      v_opt.id,
      v_shares_estimate,
      v_option_max_cost
    ) INTO v_trade_result;
    
    IF v_trade_result->>'success' = 'true' THEN
      v_actual_total_cost := v_actual_total_cost + (v_trade_result->>'trade_cost')::NUMERIC;
      v_remaining_budget := v_remaining_budget - (v_trade_result->>'trade_cost')::NUMERIC;
      v_results := v_results || jsonb_build_object(
        'option_id', v_opt.id,
        'option_label', v_opt.label,
        'shares', (v_trade_result->>'shares')::NUMERIC,
        'cost', (v_trade_result->>'trade_cost')::NUMERIC,
        'contract_id', v_trade_result->>'contract_id'
      );
    ELSE
      -- If any trade fails, transaction will be aborted
      RAISE EXCEPTION 'Falha ao comprar opção %: %', v_opt.label, v_trade_result->>'error';
    END IF;
  END LOOP;
  
  -- Verify total cost didn't exceed budget with slippage
  IF v_actual_total_cost > p_total_cost * (1 + p_max_slippage) THEN
    RAISE EXCEPTION 'Custo total % excedeu o orçamento máximo %', v_actual_total_cost, p_total_cost * (1 + p_max_slippage);
  END IF;
  
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