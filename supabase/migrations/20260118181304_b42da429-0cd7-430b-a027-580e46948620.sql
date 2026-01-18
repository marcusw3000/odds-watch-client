-- Add new columns to copy_subscriptions for payment tracking
ALTER TABLE copy_subscriptions 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'STRIPE' CHECK (payment_method IN ('STRIPE', 'WALLET')),
ADD COLUMN IF NOT EXISTS monthly_fee_paid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;

-- Create atomic function for wallet-based subscription
CREATE OR REPLACE FUNCTION atomic_subscribe_copy_trader(
  p_follower_id UUID,
  p_trader_id UUID,
  p_amount NUMERIC,
  p_auto_copy BOOLEAN DEFAULT true,
  p_max_trade_amount NUMERIC DEFAULT NULL,
  p_copy_percentage NUMERIC DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_copy_trader RECORD;
  v_subscription_id UUID;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Verify trader exists and is approved
  SELECT * INTO v_copy_trader FROM copy_traders 
  WHERE id = p_trader_id AND status = 'APPROVED';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trader not found or not approved');
  END IF;
  
  -- Cannot subscribe to yourself
  IF v_copy_trader.user_id = p_follower_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot subscribe to yourself');
  END IF;
  
  -- Lock wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_follower_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  IF v_wallet.balance_available < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'required', p_amount, 'available', v_wallet.balance_available);
  END IF;
  
  -- Check for existing active subscription
  IF EXISTS (
    SELECT 1 FROM copy_subscriptions 
    WHERE follower_id = p_follower_id AND trader_id = p_trader_id 
    AND status = 'ACTIVE'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already subscribed to this trader');
  END IF;
  
  v_period_end := now() + interval '30 days';
  
  -- Deduct balance
  UPDATE wallets SET
    balance_available = balance_available - p_amount,
    updated_at = now()
  WHERE user_id = p_follower_id;
  
  -- Create ledger entry
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, status, description
  ) VALUES (
    p_follower_id, v_wallet.id, p_amount, p_amount, 'DEBIT', 'OTHER', 'COMPLETED',
    'Copy Trade subscription: ' || v_copy_trader.display_name
  );
  
  -- Create subscription
  INSERT INTO copy_subscriptions (
    follower_id, trader_id, status, auto_copy, max_trade_amount, 
    copy_percentage, current_period_start, current_period_end,
    payment_method, monthly_fee_paid, last_payment_at
  ) VALUES (
    p_follower_id, p_trader_id, 'ACTIVE', p_auto_copy, p_max_trade_amount,
    p_copy_percentage, now(), v_period_end,
    'WALLET', p_amount, now()
  ) RETURNING id INTO v_subscription_id;
  
  -- Update trader follower count
  UPDATE copy_traders SET 
    total_followers = total_followers + 1,
    updated_at = now()
  WHERE id = p_trader_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'period_end', v_period_end,
    'amount_charged', p_amount,
    'new_balance', v_wallet.balance_available - p_amount
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION atomic_subscribe_copy_trader TO authenticated;