-- =====================================================
-- 1. Update atomic_subscribe_copy_trader to split subscription fee
-- =====================================================

CREATE OR REPLACE FUNCTION public.atomic_subscribe_copy_trader(
  p_follower_id uuid,
  p_trader_id uuid,
  p_amount numeric,
  p_auto_copy boolean DEFAULT true,
  p_max_trade_amount numeric DEFAULT 100,
  p_copy_percentage numeric DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_trader_wallet RECORD;
  v_copy_trader RECORD;
  v_settings RECORD;
  v_subscription_id uuid;
  v_ledger_id uuid;
  v_trader_ledger_id uuid;
  v_trader_split numeric;
  v_trader_share numeric;
  v_platform_share numeric;
BEGIN
  -- Get copy trade settings
  SELECT * INTO v_settings FROM copy_trade_settings LIMIT 1;
  
  -- Get copy trader info
  SELECT * INTO v_copy_trader FROM copy_traders WHERE id = p_trader_id;
  
  IF v_copy_trader IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trader not found');
  END IF;
  
  IF v_copy_trader.status != 'APPROVED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trader not approved');
  END IF;
  
  -- Get follower wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_follower_id FOR UPDATE;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  IF v_wallet.balance_available < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Get trader wallet
  SELECT * INTO v_trader_wallet FROM wallets WHERE user_id = v_copy_trader.user_id FOR UPDATE;
  
  IF v_trader_wallet IS NULL THEN
    -- Create wallet for trader if not exists
    INSERT INTO wallets (user_id, balance_available, balance_reserved)
    VALUES (v_copy_trader.user_id, 0, 0)
    RETURNING * INTO v_trader_wallet;
  END IF;
  
  -- Calculate splits
  v_trader_split := COALESCE(v_copy_trader.custom_trader_split, v_settings.default_trader_split);
  v_trader_share := p_amount * (v_trader_split / 100);
  v_platform_share := p_amount - v_trader_share;
  
  -- Debit follower wallet
  UPDATE wallets SET
    balance_available = balance_available - p_amount,
    updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Credit trader wallet with their share
  UPDATE wallets SET
    balance_available = balance_available + v_trader_share,
    updated_at = now()
  WHERE id = v_trader_wallet.id;
  
  -- Create ledger entry for follower (DEBIT)
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, 
    ref_type, status, description
  ) VALUES (
    p_follower_id, v_wallet.id, p_amount, p_amount, 'DEBIT', 
    'COPY_SUBSCRIPTION', 'COMPLETED',
    'Assinatura Copy Trade: ' || v_copy_trader.display_name
  ) RETURNING id INTO v_ledger_id;
  
  -- Create ledger entry for trader (CREDIT)
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, 
    ref_type, status, description
  ) VALUES (
    v_copy_trader.user_id, v_trader_wallet.id, v_trader_share, v_trader_share, 'CREDIT', 
    'COPY_SUBSCRIPTION', 'COMPLETED',
    'Receita de assinatura Copy Trade'
  ) RETURNING id INTO v_trader_ledger_id;
  
  -- Create subscription
  INSERT INTO copy_subscriptions (
    follower_id, trader_id, status, auto_copy,
    max_trade_amount, copy_percentage,
    total_trades_copied, total_profit, total_commission_paid
  ) VALUES (
    p_follower_id, p_trader_id, 'ACTIVE', p_auto_copy,
    p_max_trade_amount, p_copy_percentage,
    0, 0, 0
  ) RETURNING id INTO v_subscription_id;
  
  -- Update trader stats
  UPDATE copy_traders SET
    total_followers = total_followers + 1,
    total_earnings = total_earnings + v_trader_share,
    updated_at = now()
  WHERE id = p_trader_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'amount_charged', p_amount,
    'trader_share', v_trader_share,
    'platform_share', v_platform_share
  );
END;
$function$;

-- =====================================================
-- 2. Create process_market_payouts function
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_market_payouts(
  p_market_id uuid,
  p_winning_outcome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_wallet RECORD;
  v_payout numeric;
  v_total_payouts numeric := 0;
  v_winner_count integer := 0;
BEGIN
  -- For each winning contract in this market
  FOR v_contract IN 
    SELECT uc.id, uc.user_id, uc.shares, uc.position
    FROM user_contracts uc
    WHERE uc.market_id = p_market_id 
      AND uc.position = p_winning_outcome
      AND uc.shares > 0
  LOOP
    -- Get user wallet
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_contract.user_id FOR UPDATE;
    
    IF v_wallet IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Calculate payout (1 BRL per share for winning contracts)
    v_payout := v_contract.shares;
    
    -- Credit user wallet
    UPDATE wallets SET
      balance_available = balance_available + v_payout,
      updated_at = now()
    WHERE id = v_wallet.id;
    
    -- Create ledger entry
    INSERT INTO ledger_entries (
      user_id, wallet_id, amount, net_amount, direction,
      ref_type, status, description
    ) VALUES (
      v_contract.user_id, v_wallet.id, v_payout, v_payout, 'CREDIT',
      'SETTLEMENT', 'COMPLETED',
      'Ganho - Mercado liquidado'
    );
    
    -- Create PAYOUT transaction
    INSERT INTO transactions (
      user_id, market_id, type, position, shares,
      total_amount, price_per_share
    ) VALUES (
      v_contract.user_id, p_market_id, 'PAYOUT', v_contract.position,
      v_contract.shares, v_payout, 1
    );
    
    v_total_payouts := v_total_payouts + v_payout;
    v_winner_count := v_winner_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'winners', v_winner_count,
    'total_payouts', v_total_payouts
  );
END;
$function$;

-- =====================================================
-- 3. Create process_copy_trade_commissions function
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_copy_trade_commissions(
  p_market_id uuid,
  p_winning_outcome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trade RECORD;
  v_trader_wallet RECORD;
  v_settings RECORD;
  v_shares numeric;
  v_payout numeric;
  v_profit numeric;
  v_profit_share_percent numeric;
  v_trader_split numeric;
  v_commission_total numeric;
  v_trader_share numeric;
  v_platform_share numeric;
  v_commissions_processed integer := 0;
  v_total_trader_earnings numeric := 0;
BEGIN
  -- Get global settings
  SELECT * INTO v_settings FROM copy_trade_settings LIMIT 1;
  
  -- For each EXECUTED copied_trade for this market that hasn't been settled
  FOR v_trade IN 
    SELECT 
      ct.id as copied_trade_id,
      ct.subscription_id,
      ct.copied_amount,
      ct.copied_price,
      ct.outcome,
      cs.follower_id,
      cs.trader_id,
      ctr.user_id as trader_user_id,
      COALESCE(ctr.profit_share_percent, v_settings.default_profit_share_percent) as profit_share,
      COALESCE(ctr.custom_trader_split, v_settings.default_trader_split) as trader_split
    FROM copied_trades ct
    JOIN copy_subscriptions cs ON cs.id = ct.subscription_id
    JOIN copy_traders ctr ON ctr.id = cs.trader_id
    WHERE ct.market_id = p_market_id 
      AND ct.status = 'EXECUTED'
      AND ct.is_settled = false
      AND ct.outcome = p_winning_outcome
  LOOP
    -- Calculate shares bought and payout
    v_shares := v_trade.copied_amount / v_trade.copied_price;
    v_payout := v_shares; -- 1 BRL per share for winners
    v_profit := v_payout - v_trade.copied_amount;
    
    -- Get profit share and trader split
    v_profit_share_percent := v_trade.profit_share;
    v_trader_split := v_trade.trader_split;
    
    IF v_profit > 0 THEN
      -- Calculate commissions
      v_commission_total := v_profit * (v_profit_share_percent / 100);
      v_trader_share := v_commission_total * (v_trader_split / 100);
      v_platform_share := v_commission_total - v_trader_share;
      
      -- Get trader wallet
      SELECT * INTO v_trader_wallet 
      FROM wallets 
      WHERE user_id = v_trade.trader_user_id 
      FOR UPDATE;
      
      IF v_trader_wallet IS NOT NULL THEN
        -- Credit trader wallet
        UPDATE wallets SET
          balance_available = balance_available + v_trader_share,
          updated_at = now()
        WHERE id = v_trader_wallet.id;
        
        -- Create ledger entry for trader
        INSERT INTO ledger_entries (
          user_id, wallet_id, amount, net_amount, direction,
          ref_type, status, description
        ) VALUES (
          v_trade.trader_user_id, v_trader_wallet.id, v_trader_share, v_trader_share, 'CREDIT',
          'COPY_COMMISSION', 'COMPLETED',
          'Comissão Copy Trade - Lucro de seguidor'
        );
        
        -- Insert commission record
        INSERT INTO copy_trade_commissions (
          copied_trade_id, trader_id, follower_id,
          profit_amount, profit_share_percent, commission_total,
          trader_split_percent, platform_split_percent,
          trader_share, platform_share
        ) VALUES (
          v_trade.copied_trade_id, v_trade.trader_id, v_trade.follower_id,
          v_profit, v_profit_share_percent, v_commission_total,
          v_trader_split, 100 - v_trader_split,
          v_trader_share, v_platform_share
        );
        
        -- Update trader total earnings
        UPDATE copy_traders SET
          total_earnings = total_earnings + v_trader_share,
          updated_at = now()
        WHERE id = v_trade.trader_id;
        
        -- Update subscription stats
        UPDATE copy_subscriptions SET
          total_profit = total_profit + v_profit,
          total_commission_paid = total_commission_paid + v_commission_total,
          updated_at = now()
        WHERE id = v_trade.subscription_id;
        
        v_total_trader_earnings := v_total_trader_earnings + v_trader_share;
        v_commissions_processed := v_commissions_processed + 1;
      END IF;
    END IF;
    
    -- Mark copied trade as settled
    UPDATE copied_trades SET
      is_settled = true,
      profit_amount = v_profit,
      commission_processed = (v_profit > 0),
      settled_at = now()
    WHERE id = v_trade.copied_trade_id;
    
  END LOOP;
  
  -- Also mark losing copied trades as settled
  UPDATE copied_trades SET
    is_settled = true,
    profit_amount = 0 - copied_amount, -- Loss = negative of cost
    commission_processed = false,
    settled_at = now()
  WHERE market_id = p_market_id
    AND status = 'EXECUTED'
    AND is_settled = false
    AND outcome != p_winning_outcome;
  
  RETURN jsonb_build_object(
    'success', true,
    'commissions_processed', v_commissions_processed,
    'total_trader_earnings', v_total_trader_earnings
  );
END;
$function$;