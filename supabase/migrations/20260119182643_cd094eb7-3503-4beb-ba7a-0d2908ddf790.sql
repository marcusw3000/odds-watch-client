-- Fix process_market_payouts function: use correct wallet column names
-- The wallets table uses 'balance_available' NOT 'balance' or 'available_balance'

CREATE OR REPLACE FUNCTION public.process_market_payouts(
  p_market_id UUID,
  p_winning_outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market RECORD;
  v_contract RECORD;
  v_payout_amount DECIMAL(18,2);
  v_total_payouts DECIMAL(18,2) := 0;
  v_users_paid INT := 0;
  v_wallet_id UUID;
BEGIN
  -- Get market details
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;

  -- Process each winning contract
  FOR v_contract IN 
    SELECT uc.*, p.id as profile_id
    FROM user_contracts uc
    JOIN profiles p ON p.id = uc.user_id
    WHERE uc.market_id = p_market_id 
      AND uc.position = p_winning_outcome
      AND uc.shares > 0
  LOOP
    -- Calculate payout (shares * 1.00 since winning contracts pay out at full value)
    v_payout_amount := v_contract.shares;
    
    -- Get or create wallet (using correct column names)
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
    
    IF v_wallet_id IS NULL THEN
      INSERT INTO wallets (user_id, balance_available, balance_locked, currency)
      VALUES (v_contract.user_id, 0, 0, 'BRL')
      RETURNING id INTO v_wallet_id;
    END IF;
    
    -- Update wallet balance (using correct column: balance_available)
    UPDATE wallets 
    SET balance_available = balance_available + v_payout_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Create ledger entry (using meta JSONB column)
    INSERT INTO ledger_entries (
      user_id,
      wallet_id,
      ref_type,
      ref_id,
      direction,
      amount,
      fee_amount,
      net_amount,
      status,
      meta
    ) VALUES (
      v_contract.user_id,
      v_wallet_id,
      'SETTLEMENT',
      p_market_id,
      'CREDIT',
      v_payout_amount,
      0,
      v_payout_amount,
      'COMPLETED',
      jsonb_build_object(
        'description', 'Ganho - Mercado liquidado',
        'market_id', p_market_id,
        'market_title', v_market.title,
        'position', p_winning_outcome,
        'shares', v_contract.shares
      )
    );
    
    -- Create transaction record
    INSERT INTO transactions (
      user_id,
      market_id,
      type,
      position,
      shares,
      price_per_share,
      total_amount,
      created_at
    ) VALUES (
      v_contract.user_id,
      p_market_id,
      'PAYOUT',
      p_winning_outcome,
      v_contract.shares,
      1.00,
      v_payout_amount,
      NOW()
    );
    
    -- Update user profile statistics
    UPDATE profiles
    SET 
      winning_trades = COALESCE(winning_trades, 0) + 1,
      total_profit = COALESCE(total_profit, 0) + (v_payout_amount - COALESCE(v_contract.total_invested, 0)),
      roi_percent = CASE 
        WHEN COALESCE(total_volume, 0) > 0 
        THEN ((COALESCE(total_profit, 0) + (v_payout_amount - COALESCE(v_contract.total_invested, 0))) / total_volume) * 100 
        ELSE 0 
      END,
      updated_at = NOW()
    WHERE id = v_contract.user_id;
    
    v_total_payouts := v_total_payouts + v_payout_amount;
    v_users_paid := v_users_paid + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_payouts', v_total_payouts,
    'users_paid', v_users_paid,
    'market_id', p_market_id,
    'winning_outcome', p_winning_outcome
  );
END;
$$;

-- Also fix process_copy_trade_commissions to use correct column names
CREATE OR REPLACE FUNCTION public.process_copy_trade_commissions(p_market_id uuid, p_winning_outcome text)
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
      
      -- Get trader wallet (using correct column names)
      SELECT * INTO v_trader_wallet 
      FROM wallets 
      WHERE user_id = v_trade.trader_user_id 
      FOR UPDATE;
      
      IF v_trader_wallet IS NOT NULL THEN
        -- Credit trader wallet (using correct column: balance_available)
        UPDATE wallets SET
          balance_available = balance_available + v_trader_share,
          updated_at = now()
        WHERE id = v_trader_wallet.id;
        
        -- Create ledger entry for trader (using meta JSONB column)
        INSERT INTO ledger_entries (
          user_id, wallet_id, amount, net_amount, direction,
          ref_type, status, meta
        ) VALUES (
          v_trade.trader_user_id, v_trader_wallet.id, v_trader_share, v_trader_share, 'CREDIT',
          'COPY_COMMISSION', 'COMPLETED',
          jsonb_build_object('description', 'Comissão Copy Trade - Lucro de seguidor')
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