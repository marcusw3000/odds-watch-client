-- Fix: Remove FOR UPDATE from aggregate query in atomic_execute_multi_trade_batch
-- PostgreSQL doesn't allow FOR UPDATE with aggregate functions

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
  v_market RECORD;
  v_wallet RECORD;
  v_opt RECORD;
  v_all_shares NUMERIC[];
  v_option_ids UUID[];
  v_option_index INTEGER;
  v_total_price NUMERIC := 0;
  v_allocation NUMERIC;
  v_option_budget NUMERIC;
  v_shares_to_buy NUMERIC;
  v_remaining_budget NUMERIC;
  v_actual_total_cost NUMERIC := 0;
  v_contracts JSONB := '[]'::JSONB;
  v_trade_result JSONB;
  v_b NUMERIC;
  v_internal_buffer NUMERIC := 0.15;
  v_min_shares NUMERIC := 0.01;
  v_skipped_count INTEGER := 0;
  v_bought_count INTEGER := 0;
  v_new_balance NUMERIC;
  v_arr_index INTEGER := 1;
BEGIN
  -- 1) Lock and validate market
  SELECT * INTO v_market
  FROM markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF v_market IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não encontrado');
  END IF;

  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não está aberto para negociação');
  END IF;

  IF v_market.market_type != 'MULTIPLE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta função é apenas para mercados de múltiplas opções');
  END IF;

  v_b := COALESCE(v_market.lmsr_b, 100);

  -- 2) Validate user wallet
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;

  IF v_wallet.balance_available < p_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Saldo insuficiente. Disponível: R$%.2f, Necessário: R$%.2f', v_wallet.balance_available, p_total_cost));
  END IF;

  -- 3) Lock options and build arrays manually (no aggregates with FOR UPDATE)
  v_all_shares := ARRAY[]::NUMERIC[];
  v_option_ids := ARRAY[]::UUID[];
  v_total_price := 0;
  
  FOR v_opt IN 
    SELECT id, shares, current_price
    FROM market_options
    WHERE market_id = p_market_id
    ORDER BY display_order
    FOR UPDATE
  LOOP
    v_all_shares := array_append(v_all_shares, v_opt.shares);
    v_option_ids := array_append(v_option_ids, v_opt.id);
    v_total_price := v_total_price + v_opt.current_price;
  END LOOP;

  IF array_length(v_all_shares, 1) IS NULL OR array_length(v_all_shares, 1) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado precisa ter pelo menos 2 opções');
  END IF;

  IF NOT (p_exclude_option_id = ANY(v_option_ids)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opção excluída não encontrada no mercado');
  END IF;

  v_remaining_budget := p_total_cost * (1 + p_max_slippage);

  -- 4) Process each option (except excluded)
  FOR v_opt IN 
    SELECT id, label, current_price, shares, display_order
    FROM market_options
    WHERE market_id = p_market_id AND id != p_exclude_option_id
    ORDER BY display_order
  LOOP
    v_allocation := p_total_cost * (v_opt.current_price / NULLIF(v_total_price, 0));
    v_option_budget := LEAST(v_remaining_budget, v_allocation * (1 + v_internal_buffer));
    
    IF v_option_budget < 0.10 THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Find option index in array
    v_option_index := NULL;
    FOR v_arr_index IN 1..array_length(v_option_ids, 1) LOOP
      IF v_option_ids[v_arr_index] = v_opt.id THEN
        v_option_index := v_arr_index;
        EXIT;
      END IF;
    END LOOP;

    IF v_option_index IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Refresh shares array (in case previous trades updated them)
    v_all_shares := ARRAY[]::NUMERIC[];
    FOR v_opt IN 
      SELECT shares
      FROM market_options
      WHERE market_id = p_market_id
      ORDER BY display_order
    LOOP
      v_all_shares := array_append(v_all_shares, v_opt.shares);
    END LOOP;

    v_shares_to_buy := calculate_shares_for_budget(
      v_all_shares,
      v_option_index,
      v_option_budget,
      v_b
    );

    IF v_shares_to_buy < v_min_shares THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Re-fetch the option data (since we reused v_opt variable above)
    SELECT id, label, current_price, shares, display_order INTO v_opt
    FROM market_options
    WHERE id = v_option_ids[v_option_index];

    v_trade_result := atomic_execute_multi_trade(
      p_user_id,
      p_market_id,
      v_opt.id,
      v_shares_to_buy,
      v_option_budget
    );

    IF NOT (v_trade_result->>'success')::BOOLEAN THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Falha ao comprar opção %s: %s', v_opt.label, v_trade_result->>'error'),
        'partial_contracts', v_contracts,
        'partial_cost', v_actual_total_cost
      );
    END IF;

    v_actual_total_cost := v_actual_total_cost + (v_trade_result->>'cost')::NUMERIC;
    v_remaining_budget := v_remaining_budget - (v_trade_result->>'cost')::NUMERIC;
    v_bought_count := v_bought_count + 1;

    v_contracts := v_contracts || jsonb_build_object(
      'option_id', v_opt.id,
      'option_label', v_opt.label,
      'shares', (v_trade_result->>'shares')::NUMERIC,
      'cost', (v_trade_result->>'cost')::NUMERIC,
      'contract_id', v_trade_result->>'contract_id'
    );

    IF v_remaining_budget < 0.10 THEN
      EXIT;
    END IF;
  END LOOP;

  -- 5) Final validation
  IF v_bought_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma opção pôde ser comprada com o orçamento fornecido');
  END IF;

  IF v_actual_total_cost > p_total_cost * (1 + p_max_slippage) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Custo total (R$%.2f) excedeu tolerância de slippage', v_actual_total_cost)
    );
  END IF;

  -- 6) Get updated balance
  SELECT balance_available INTO v_new_balance
  FROM wallets
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'contracts', v_contracts,
    'total_cost', v_actual_total_cost,
    'new_balance', v_new_balance,
    'excluded_option_id', p_exclude_option_id,
    'options_bought', v_bought_count,
    'options_skipped', v_skipped_count
  );
END;
$$;