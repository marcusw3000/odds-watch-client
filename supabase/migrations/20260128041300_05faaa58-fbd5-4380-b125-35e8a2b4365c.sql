-- Add unique constraint on platform_revenue for day+type to allow ON CONFLICT upserts
ALTER TABLE platform_revenue 
ADD CONSTRAINT platform_revenue_day_type_unique 
UNIQUE (day, type);

-- Replace atomic_execute_trade function to include fee calculation and platform revenue
CREATE OR REPLACE FUNCTION public.atomic_execute_trade(
  p_user_id uuid,
  p_market_id uuid,
  p_outcome text,
  p_shares numeric,
  p_trade_cost numeric,
  p_new_yes_price numeric,
  p_new_no_price numeric,
  p_new_yes_shares numeric,
  p_new_no_shares numeric,
  p_new_liquidity numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_market RECORD;
  v_transaction_id uuid;
  v_contract_id uuid;
  v_existing_contract RECORD;
  v_fee_rule RECORD;
  v_fee_amount numeric := 0;
  v_net_cost numeric;
  v_fee_snapshot_id uuid;
BEGIN
  -- Lock the wallet row to prevent concurrent modifications
  SELECT * INTO v_wallet 
  FROM wallets 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
  
  -- Lock the market row
  SELECT * INTO v_market 
  FROM markets 
  WHERE id = p_market_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found: %', p_market_id;
  END IF;
  
  -- Check market status
  IF v_market.status != 'OPEN' THEN
    RAISE EXCEPTION 'Market is not open for trading';
  END IF;
  
  -- Fetch active fee rule for TRADE
  SELECT * INTO v_fee_rule 
  FROM fee_rules 
  WHERE type = 'TRADE' AND is_active = true 
  ORDER BY effective_from DESC 
  LIMIT 1;
  
  -- Calculate fee based on rule mode
  IF FOUND THEN
    IF v_fee_rule.mode = 'PERCENT' THEN
      v_fee_amount := p_trade_cost * COALESCE(v_fee_rule.percent_value, 0);
    ELSIF v_fee_rule.mode = 'FIXED' THEN
      v_fee_amount := COALESCE(v_fee_rule.flat_value, 0);
    END IF;
    
    -- Apply min/max fee constraints
    IF v_fee_rule.min_fee IS NOT NULL AND v_fee_amount < v_fee_rule.min_fee THEN
      v_fee_amount := v_fee_rule.min_fee;
    END IF;
    IF v_fee_rule.max_fee IS NOT NULL AND v_fee_amount > v_fee_rule.max_fee THEN
      v_fee_amount := v_fee_rule.max_fee;
    END IF;
    
    -- Create fee policy snapshot
    INSERT INTO fee_policy_snapshots (fee_rule_id, type, applied_mode, applied_percent, applied_flat, applied_tiers)
    VALUES (v_fee_rule.id, 'TRADE', v_fee_rule.mode, v_fee_rule.percent_value, v_fee_rule.flat_value, v_fee_rule.tiers)
    RETURNING id INTO v_fee_snapshot_id;
  END IF;
  
  -- Calculate net cost (amount user pays = trade cost + fee)
  v_net_cost := p_trade_cost + v_fee_amount;
  
  -- Check balance (user needs to pay trade_cost + fee)
  IF v_wallet.balance_available < v_net_cost THEN
    RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', v_net_cost, v_wallet.balance_available;
  END IF;
  
  -- Deduct from wallet (total cost including fee)
  UPDATE wallets 
  SET balance_available = balance_available - v_net_cost,
      updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id, market_id, type, outcome, shares, 
    price_per_share, total_amount, status
  ) VALUES (
    p_user_id, p_market_id, 'BUY', p_outcome, p_shares,
    p_trade_cost / p_shares, p_trade_cost, 'COMPLETED'
  ) RETURNING id INTO v_transaction_id;
  
  -- Check for existing contract
  SELECT * INTO v_existing_contract
  FROM user_contracts
  WHERE user_id = p_user_id 
    AND market_id = p_market_id 
    AND outcome = p_outcome
  FOR UPDATE;
  
  IF FOUND THEN
    -- Update existing contract
    UPDATE user_contracts
    SET shares = shares + p_shares,
        avg_price = ((avg_price * shares) + p_trade_cost) / (shares + p_shares),
        updated_at = now()
    WHERE id = v_existing_contract.id
    RETURNING id INTO v_contract_id;
  ELSE
    -- Create new contract
    INSERT INTO user_contracts (
      user_id, market_id, outcome, shares, avg_price
    ) VALUES (
      p_user_id, p_market_id, p_outcome, p_shares, p_trade_cost / p_shares
    ) RETURNING id INTO v_contract_id;
  END IF;
  
  -- Update market prices and shares
  UPDATE markets
  SET current_yes_price = p_new_yes_price,
      current_no_price = p_new_no_price,
      yes_shares = p_new_yes_shares,
      no_shares = p_new_no_shares,
      liquidity_pool = p_new_liquidity,
      total_volume = total_volume + p_trade_cost,
      updated_at = now()
  WHERE id = p_market_id;
  
  -- Record price history
  INSERT INTO market_price_history (market_id, yes_price, no_price, source)
  VALUES (p_market_id, p_new_yes_price, p_new_no_price, 'trade');
  
  -- Create ledger entry with fee information
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, fee_amount, net_amount, 
    platform_revenue, direction, ref_type, ref_id, status, fee_snapshot_id
  ) VALUES (
    p_user_id, v_wallet.id, p_trade_cost, v_fee_amount, v_net_cost,
    v_fee_amount, 'DEBIT', 'TRADE', v_transaction_id, 'COMPLETED', v_fee_snapshot_id
  );
  
  -- Accumulate platform revenue (only if there's a fee)
  IF v_fee_amount > 0 THEN
    INSERT INTO platform_revenue (day, type, gross, fees, net)
    VALUES (CURRENT_DATE, 'TRADE', p_trade_cost, v_fee_amount, p_trade_cost - v_fee_amount)
    ON CONFLICT (day, type) 
    DO UPDATE SET 
      gross = platform_revenue.gross + EXCLUDED.gross,
      fees = platform_revenue.fees + EXCLUDED.fees,
      net = platform_revenue.net + EXCLUDED.net,
      updated_at = now();
  END IF;
  
  -- Update user profile stats
  UPDATE profiles
  SET total_trades = total_trades + 1,
      total_volume = total_volume + p_trade_cost,
      updated_at = now()
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'contract_id', v_contract_id,
    'fee_amount', v_fee_amount,
    'total_paid', v_net_cost
  );
END;
$$;