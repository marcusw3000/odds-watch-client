-- ============================================================================
-- ROBUST MULTI-OPTION BATCH TRADE: Binary Search for Budget-Based Share Calculation
-- Replaces linear estimation with precise LMSR cost calculation
-- ============================================================================

-- Helper function: Calculate shares that fit within a budget using binary search
CREATE OR REPLACE FUNCTION calculate_shares_for_budget(
  p_all_shares NUMERIC[],
  p_option_index INTEGER,
  p_budget NUMERIC,
  p_b NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_low NUMERIC := 0;
  v_high NUMERIC := 10000;
  v_mid NUMERIC;
  v_cost NUMERIC;
  v_current_cost NUMERIC;
  v_test_shares NUMERIC[];
  v_iterations INTEGER := 0;
  v_max_iterations INTEGER := 50;
  v_epsilon NUMERIC := 0.001;
  v_best_shares NUMERIC := 0;
BEGIN
  IF p_budget < 0.01 THEN
    RETURN 0;
  END IF;

  v_current_cost := calculate_multi_lmsr_cost(p_all_shares, p_b);

  WHILE v_iterations < v_max_iterations AND (v_high - v_low) > v_epsilon LOOP
    v_mid := (v_low + v_high) / 2;
    
    v_test_shares := p_all_shares;
    v_test_shares[p_option_index] := v_test_shares[p_option_index] + v_mid;
    
    v_cost := calculate_multi_lmsr_cost(v_test_shares, p_b) - v_current_cost;
    
    IF v_cost <= p_budget THEN
      v_best_shares := v_mid;
      v_low := v_mid;
    ELSE
      v_high := v_mid;
    END IF;
    
    v_iterations := v_iterations + 1;
  END LOOP;

  IF v_best_shares > 0 THEN
    v_test_shares := p_all_shares;
    v_test_shares[p_option_index] := v_test_shares[p_option_index] + v_best_shares;
    v_cost := calculate_multi_lmsr_cost(v_test_shares, p_b) - v_current_cost;
    
    IF v_cost > p_budget THEN
      v_best_shares := v_best_shares * 0.95;
    END IF;
  END IF;

  RETURN GREATEST(0, v_best_shares);
END;
$$;

-- Replace atomic_execute_multi_trade_batch with robust budget-based implementation
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

  -- 3) Get all options ordered by display_order (LOCKED)
  SELECT 
    array_agg(shares ORDER BY display_order),
    array_agg(id ORDER BY display_order),
    SUM(current_price)
  INTO v_all_shares, v_option_ids, v_total_price
  FROM market_options
  WHERE market_id = p_market_id
  FOR UPDATE;

  IF v_all_shares IS NULL OR array_length(v_all_shares, 1) < 2 THEN
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

    SELECT idx INTO v_option_index
    FROM (
      SELECT generate_subscripts(v_option_ids, 1) as idx
    ) sub
    WHERE v_option_ids[idx] = v_opt.id;

    SELECT array_agg(shares ORDER BY display_order) 
    INTO v_all_shares
    FROM market_options
    WHERE market_id = p_market_id;

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