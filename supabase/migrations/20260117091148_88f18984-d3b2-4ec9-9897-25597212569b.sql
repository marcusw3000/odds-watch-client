-- Atualizar atomic_execute_trade para incluir estatísticas
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
  
  -- Atualizar estatísticas do usuário
  UPDATE profiles SET
    total_trades = COALESCE(total_trades, 0) + 1,
    total_volume = COALESCE(total_volume, 0) + v_trade_cost,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Verificar e conceder conquistas
  PERFORM check_and_grant_achievements(p_user_id);
  
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

-- Atualizar atomic_execute_sell para calcular lucro/prejuízo e estatísticas
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
  v_cost_basis numeric;
  v_profit numeric;
  v_is_winning boolean;
  v_current_streak integer;
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
  
  -- Calcular lucro/prejuízo da venda
  v_cost_basis := v_contract.average_price * p_shares;
  v_profit := v_sell_value - v_cost_basis;
  v_is_winning := v_profit > 0;
  
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
  
  -- Obter streak atual do usuário
  SELECT COALESCE(current_streak, 0) INTO v_current_streak FROM profiles WHERE id = p_user_id;
  
  -- Atualizar estatísticas do usuário
  UPDATE profiles SET
    total_trades = COALESCE(total_trades, 0) + 1,
    total_volume = COALESCE(total_volume, 0) + v_sell_value,
    total_profit = COALESCE(total_profit, 0) + v_profit,
    winning_trades = COALESCE(winning_trades, 0) + CASE WHEN v_is_winning THEN 1 ELSE 0 END,
    current_streak = CASE WHEN v_is_winning THEN COALESCE(current_streak, 0) + 1 ELSE 0 END,
    best_streak = GREATEST(COALESCE(best_streak, 0), CASE WHEN v_is_winning THEN v_current_streak + 1 ELSE v_current_streak END),
    best_trade_profit = GREATEST(COALESCE(best_trade_profit, 0), v_profit),
    roi_percent = CASE 
      WHEN COALESCE(total_volume, 0) + v_sell_value > 0 
      THEN ((COALESCE(total_profit, 0) + v_profit) / (COALESCE(total_volume, 0) + v_sell_value)) * 100 
      ELSE 0 
    END,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Verificar e conceder conquistas
  PERFORM check_and_grant_achievements(p_user_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'sell_value', v_sell_value,
    'shares', p_shares,
    'price_per_share', v_price_per_share,
    'new_yes_price', v_new_yes_price,
    'new_no_price', v_new_no_price,
    'transaction_id', v_transaction_id,
    'new_balance', v_wallet.balance_available + v_sell_value,
    'profit', v_profit
  );
END;
$function$;

-- Criar função para recalcular estatísticas históricas
CREATE OR REPLACE FUNCTION public.recalculate_user_statistics(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stats RECORD;
  v_sell_stats RECORD;
BEGIN
  -- Calcular estatísticas básicas a partir de transactions
  SELECT 
    COUNT(*) as total_trades,
    COALESCE(SUM(total_amount), 0) as total_volume
  INTO v_stats
  FROM transactions
  WHERE user_id = p_user_id;

  -- Calcular lucro das vendas (comparando com custo médio dos contratos vendidos)
  -- Por simplicidade, vamos calcular o lucro total baseado nas vendas
  SELECT 
    COUNT(*) FILTER (WHERE type = 'SELL') as sell_count,
    COALESCE(SUM(CASE WHEN type = 'SELL' THEN total_amount ELSE 0 END), 0) as sell_volume,
    COALESCE(SUM(CASE WHEN type = 'BUY' THEN total_amount ELSE 0 END), 0) as buy_volume
  INTO v_sell_stats
  FROM transactions
  WHERE user_id = p_user_id;

  UPDATE profiles SET
    total_trades = v_stats.total_trades,
    total_volume = v_stats.total_volume,
    -- Lucro aproximado: vendas - compras (para transações já concluídas)
    total_profit = GREATEST(0, v_sell_stats.sell_volume - v_sell_stats.buy_volume),
    updated_at = now()
  WHERE id = p_user_id;
  
  PERFORM check_and_grant_achievements(p_user_id);
END;
$$;

-- Executar recálculo para todos usuários existentes com transações
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN SELECT DISTINCT user_id FROM transactions LOOP
    PERFORM recalculate_user_statistics(v_user_id);
  END LOOP;
END;
$$;