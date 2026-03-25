CREATE OR REPLACE FUNCTION atomic_execute_multi_no_trade(
  p_user_id UUID,
  p_market_id UUID,
  p_option_id UUID,
  p_shares NUMERIC,
  p_max_cost NUMERIC DEFAULT 999999999
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_market markets%ROWTYPE;
  v_option market_options%ROWTYPE;
  v_no_price NUMERIC;
  v_cost NUMERIC;
  v_contract_id UUID;
  v_transaction_id UUID;
  v_ledger_id UUID;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;

  SELECT * INTO v_market FROM markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não encontrado');
  END IF;
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não está aberto');
  END IF;
  IF v_market.market_type != 'MULTIPLE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contratos NÃO só disponíveis para mercados múltiplos');
  END IF;

  SELECT * INTO v_option FROM market_options WHERE id = p_option_id AND market_id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opção não encontrada');
  END IF;

  v_no_price := 1.0 - v_option.current_price;
  IF v_no_price < 0.01 THEN v_no_price := 0.01;
  ELSIF v_no_price > 0.99 THEN v_no_price := 0.99;
  END IF;

  v_cost := p_shares * v_no_price;

  IF v_cost > p_max_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Custo excedeu limite de slippage', 'cost', v_cost, 'max_cost', p_max_cost);
  END IF;
  IF v_wallet.balance_available < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente', 'required', v_cost, 'available', v_wallet.balance_available);
  END IF;

  UPDATE wallets SET balance_available = balance_available - v_cost, updated_at = NOW()
  WHERE user_id = p_user_id RETURNING balance_available INTO v_new_balance;

  INSERT INTO user_contracts (
    user_id, market_id, option_id, position, contract_type,
    shares, average_price, total_invested, created_at, updated_at
  ) VALUES (
    p_user_id, p_market_id, p_option_id, 'OPTION', 'NO',
    p_shares, v_no_price, v_cost, NOW(), NOW()
  )
  ON CONFLICT (user_id, market_id, COALESCE(option_id::text, position), contract_type)
  DO UPDATE SET
    shares = user_contracts.shares + EXCLUDED.shares,
    total_invested = user_contracts.total_invested + EXCLUDED.total_invested,
    average_price = (user_contracts.total_invested + EXCLUDED.total_invested) / (user_contracts.shares + EXCLUDED.shares),
    updated_at = NOW()
  RETURNING id INTO v_contract_id;

  -- Fix: use position='OPTION' with option_id to satisfy transactions_multi_option_check
  INSERT INTO transactions (
    user_id, market_id, option_id, type, position,
    shares, price_per_share, total_amount, created_at
  ) VALUES (
    p_user_id, p_market_id, p_option_id, 'BUY', 'OPTION',
    p_shares, v_no_price, v_cost, NOW()
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO ledger_entries (
    user_id, wallet_id, ref_type, ref_id, direction,
    amount, fee_amount, net_amount, platform_revenue, status, created_at
  ) VALUES (
    p_user_id, v_wallet.id, 'TRADE', v_transaction_id::text, 'DEBIT',
    v_cost, 0, v_cost, 0, 'COMPLETED', NOW()
  ) RETURNING id INTO v_ledger_id;

  UPDATE markets SET total_volume = total_volume + v_cost, updated_at = NOW() WHERE id = p_market_id;
  UPDATE profiles SET total_trades = total_trades + 1, total_volume = total_volume + v_cost, updated_at = NOW() WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 'contract_id', v_contract_id, 'transaction_id', v_transaction_id,
    'ledger_id', v_ledger_id, 'shares', p_shares, 'trade_cost', v_cost,
    'price_per_share', v_no_price, 'new_balance', v_new_balance, 'contract_type', 'NO'
  );
END;
$$;