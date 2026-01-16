-- ============================================
-- SECURITY FIX 1: Wallets Table - Remove Permissive Update Policy
-- ============================================

-- Remove the overly permissive policy that allows any authenticated user to update wallets
DROP POLICY IF EXISTS "System can update wallet balances" ON public.wallets;

-- Edge Functions use service role which bypasses RLS, so no replacement policy needed
-- Only admins should be able to update wallets via the client
CREATE POLICY "Only admins can update wallets"
ON public.wallets
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- SECURITY FIX 2: Profiles Table - Add Policy for Public Profiles
-- ============================================

-- Add policy to allow viewing public profiles without exposing all data
CREATE POLICY "Anyone can view public profiles"
ON public.profiles
FOR SELECT
USING (is_public = true OR auth.uid() = id);

-- Create a public view that excludes sensitive PII (email, full_name)
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  display_name,
  avatar_url,
  bio,
  is_public,
  show_profit,
  show_roi,
  show_volume,
  show_trades,
  total_profit,
  roi_percent,
  total_volume,
  total_trades,
  winning_trades,
  current_streak,
  best_streak,
  best_trade_profit,
  created_at,
  updated_at
FROM public.profiles
WHERE is_public = true;

-- ============================================
-- SECURITY FIX 3: Recreate wallets_with_profile View Without PII
-- ============================================

-- Drop the existing view that exposes email and full_name
DROP VIEW IF EXISTS public.wallets_with_profile;

-- Recreate view with only safe fields (display_name instead of email/full_name)
CREATE VIEW public.wallets_with_profile AS
SELECT 
  w.id,
  w.user_id,
  w.balance_available,
  w.balance_locked,
  w.total_deposited,
  w.total_withdrawn,
  w.currency,
  w.created_at,
  w.updated_at,
  p.display_name,
  p.avatar_url
FROM public.wallets w
LEFT JOIN public.profiles p ON w.user_id = p.id;

-- ============================================
-- SECURITY FIX 4: Atomic Functions for Trade Execution
-- ============================================

-- Function for atomic trade execution (BUY)
CREATE OR REPLACE FUNCTION public.atomic_execute_trade(
  p_user_id uuid,
  p_market_id uuid,
  p_outcome text,
  p_shares numeric,
  p_max_cost numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Lock wallet row to prevent concurrent modifications
  SELECT * INTO v_wallet 
  FROM wallets 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Lock market row to prevent concurrent modifications
  SELECT * INTO v_market 
  FROM markets 
  WHERE id = p_market_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  -- Check market status
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market is not open for trading');
  END IF;
  
  -- LMSR calculations
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
  
  -- Check slippage
  IF v_trade_cost > p_max_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price exceeded maximum cost (slippage protection)');
  END IF;
  
  -- Check balance
  IF v_wallet.balance_available < v_trade_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Calculate new prices
  v_new_yes_price := exp(v_new_yes_shares / v_b) / (exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_new_no_price := 1 - v_new_yes_price;
  v_price_per_share := v_trade_cost / p_shares;
  
  -- Update market
  UPDATE markets SET
    yes_shares = v_new_yes_shares,
    no_shares = v_new_no_shares,
    current_yes_price = v_new_yes_price,
    current_no_price = v_new_no_price,
    total_volume = total_volume + v_trade_cost,
    updated_at = now()
  WHERE id = p_market_id;
  
  -- Update wallet
  UPDATE wallets SET
    balance_available = balance_available - v_trade_cost,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Create ledger entry
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
  ) VALUES (
    p_user_id, v_wallet.id, v_trade_cost, v_trade_cost, 'OUT', 'TRADE', p_market_id, 'COMPLETED'
  ) RETURNING id INTO v_ledger_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id, market_id, type, position, shares, price_per_share, total_amount
  ) VALUES (
    p_user_id, p_market_id, 'BUY', p_outcome, p_shares, v_price_per_share, v_trade_cost
  ) RETURNING id INTO v_transaction_id;
  
  -- Update or create user contract
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
$$;

-- Function for atomic sell execution
CREATE OR REPLACE FUNCTION public.atomic_execute_sell(
  p_user_id uuid,
  p_contract_id uuid,
  p_shares numeric,
  p_min_value numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  -- Lock contract row
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
  
  -- Lock wallet row
  SELECT * INTO v_wallet 
  FROM wallets 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Lock market row
  SELECT * INTO v_market 
  FROM markets 
  WHERE id = v_contract.market_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  -- Check market status
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market is not open for trading');
  END IF;
  
  -- LMSR calculations for sell
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
  
  -- Check slippage (minimum value protection)
  IF v_sell_value < p_min_value THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price below minimum value (slippage protection)');
  END IF;
  
  -- Calculate new prices
  v_new_yes_price := exp(v_new_yes_shares / v_b) / (exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_new_no_price := 1 - v_new_yes_price;
  v_price_per_share := v_sell_value / p_shares;
  
  -- Update market
  UPDATE markets SET
    yes_shares = v_new_yes_shares,
    no_shares = v_new_no_shares,
    current_yes_price = v_new_yes_price,
    current_no_price = v_new_no_price,
    updated_at = now()
  WHERE id = v_contract.market_id;
  
  -- Update wallet (add sell value)
  UPDATE wallets SET
    balance_available = balance_available + v_sell_value,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Create ledger entry
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
  ) VALUES (
    p_user_id, v_wallet.id, v_sell_value, v_sell_value, 'IN', 'TRADE', v_contract.market_id, 'COMPLETED'
  ) RETURNING id INTO v_ledger_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id, market_id, type, position, shares, price_per_share, total_amount
  ) VALUES (
    p_user_id, v_contract.market_id, 'SELL', v_contract.position, p_shares, v_price_per_share, v_sell_value
  ) RETURNING id INTO v_transaction_id;
  
  -- Update contract (reduce shares or delete if zero)
  IF v_contract.shares = p_shares THEN
    DELETE FROM user_contracts WHERE id = p_contract_id;
  ELSE
    UPDATE user_contracts SET
      shares = shares - p_shares,
      total_invested = total_invested - (v_contract.average_price * p_shares),
      updated_at = now()
    WHERE id = p_contract_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'sell_value', v_sell_value,
    'shares', p_shares,
    'price_per_share', v_price_per_share,
    'new_yes_price', v_new_yes_price,
    'new_no_price', v_new_no_price,
    'transaction_id', v_transaction_id,
    'new_balance', v_wallet.balance_available + v_sell_value
  );
END;
$$;