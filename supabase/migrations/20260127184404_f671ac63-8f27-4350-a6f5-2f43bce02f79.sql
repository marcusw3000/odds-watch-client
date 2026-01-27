-- ============================================================================
-- Migration: Kalshi-Style NO Contracts for Multi-Option Markets
-- ============================================================================
-- This migration adds support for "NO" contracts where:
-- - Buying NO on option X creates a single contract that pays if X loses
-- - If X wins: contract pays R$0 (total loss)
-- - If X loses: contract pays R$1 per share (win)
-- ============================================================================

-- 1. Add contract_type column to differentiate YES/NO contracts
ALTER TABLE user_contracts 
ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'YES';

-- Add check constraint for valid contract types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_contracts_contract_type_check'
  ) THEN
    ALTER TABLE user_contracts 
    ADD CONSTRAINT user_contracts_contract_type_check 
    CHECK (contract_type IN ('YES', 'NO'));
  END IF;
END $$;

-- 2. Update unique index to allow both YES and NO contracts on the same option
DROP INDEX IF EXISTS idx_user_contracts_unique_position;
CREATE UNIQUE INDEX idx_user_contracts_unique_position ON user_contracts 
  (user_id, market_id, COALESCE(option_id::text, position), contract_type);

-- 3. Create function to execute NO trades for multi-option markets
CREATE OR REPLACE FUNCTION atomic_execute_multi_no_trade(
  p_user_id UUID,
  p_market_id UUID,
  p_option_id UUID,
  p_shares NUMERIC,
  p_max_cost NUMERIC
)
RETURNS JSONB
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
  -- Lock wallet for update
  SELECT * INTO v_wallet FROM wallets 
  WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira não encontrada');
  END IF;
  
  -- Get market
  SELECT * INTO v_market FROM markets 
  WHERE id = p_market_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não encontrado');
  END IF;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não está aberto');
  END IF;
  
  IF v_market.market_type != 'MULTIPLE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contratos NÃO só disponíveis para mercados múltiplos');
  END IF;
  
  -- Get option
  SELECT * INTO v_option FROM market_options 
  WHERE id = p_option_id AND market_id = p_market_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opção não encontrada');
  END IF;
  
  -- Calculate NO price = 1 - YES price (in decimal)
  -- current_price is stored as decimal (0.XX), so NO price = 1.0 - current_price
  v_no_price := 1.0 - v_option.current_price;
  
  -- Ensure NO price is within bounds (minimum 0.01, maximum 0.99)
  IF v_no_price < 0.01 THEN
    v_no_price := 0.01;
  ELSIF v_no_price > 0.99 THEN
    v_no_price := 0.99;
  END IF;
  
  -- Calculate total cost
  v_cost := p_shares * v_no_price;
  
  -- Check slippage
  IF v_cost > p_max_cost THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Custo excedeu limite de slippage',
      'cost', v_cost,
      'max_cost', p_max_cost
    );
  END IF;
  
  -- Check balance
  IF v_wallet.balance_available < v_cost THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Saldo insuficiente',
      'required', v_cost,
      'available', v_wallet.balance_available
    );
  END IF;
  
  -- Debit wallet
  UPDATE wallets 
  SET balance_available = balance_available - v_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance_available INTO v_new_balance;
  
  -- Create or update contract with contract_type = 'NO'
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
    average_price = (user_contracts.total_invested + EXCLUDED.total_invested) / 
                    (user_contracts.shares + EXCLUDED.shares),
    updated_at = NOW()
  RETURNING id INTO v_contract_id;
  
  -- Record transaction
  INSERT INTO transactions (
    user_id, market_id, option_id, type, position,
    shares, price_per_share, total_amount, created_at
  ) VALUES (
    p_user_id, p_market_id, p_option_id, 'BUY', 'NO',
    p_shares, v_no_price, v_cost, NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Create ledger entry
  INSERT INTO ledger_entries (
    user_id, wallet_id, ref_type, ref_id, direction,
    amount, fee_amount, net_amount, platform_revenue, status, created_at
  ) VALUES (
    p_user_id, v_wallet.id, 'TRADE', v_transaction_id::text, 'DEBIT',
    v_cost, 0, v_cost, 0, 'COMPLETED', NOW()
  ) RETURNING id INTO v_ledger_id;
  
  -- Update market volume (NO trades also contribute to volume)
  UPDATE markets 
  SET total_volume = total_volume + v_cost,
      updated_at = NOW()
  WHERE id = p_market_id;
  
  -- Update profile stats
  UPDATE profiles 
  SET total_trades = total_trades + 1,
      total_volume = total_volume + v_cost,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'transaction_id', v_transaction_id,
    'ledger_id', v_ledger_id,
    'shares', p_shares,
    'trade_cost', v_cost,
    'price_per_share', v_no_price,
    'new_balance', v_new_balance,
    'contract_type', 'NO'
  );
END;
$$;

-- 4. Create function to sell NO contracts
CREATE OR REPLACE FUNCTION atomic_execute_multi_no_sell(
  p_user_id UUID,
  p_contract_id UUID,
  p_shares NUMERIC,
  p_min_value NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract user_contracts%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_market markets%ROWTYPE;
  v_option market_options%ROWTYPE;
  v_no_price NUMERIC;
  v_sale_value NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_ledger_id UUID;
BEGIN
  -- Get and lock contract
  SELECT * INTO v_contract FROM user_contracts 
  WHERE id = p_contract_id AND user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contrato não encontrado');
  END IF;
  
  IF v_contract.contract_type != 'NO' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este não é um contrato NÃO');
  END IF;
  
  IF v_contract.shares < p_shares THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade insuficiente');
  END IF;
  
  -- Get market
  SELECT * INTO v_market FROM markets WHERE id = v_contract.market_id FOR UPDATE;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mercado não está aberto');
  END IF;
  
  -- Get option for current price
  SELECT * INTO v_option FROM market_options WHERE id = v_contract.option_id;
  
  -- Calculate current NO price
  v_no_price := 1.0 - v_option.current_price;
  IF v_no_price < 0.01 THEN v_no_price := 0.01; END IF;
  IF v_no_price > 0.99 THEN v_no_price := 0.99; END IF;
  
  -- Calculate sale value
  v_sale_value := p_shares * v_no_price;
  
  -- Check slippage (seller wants minimum value)
  IF v_sale_value < p_min_value THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Valor abaixo do mínimo aceitável',
      'value', v_sale_value,
      'min_value', p_min_value
    );
  END IF;
  
  -- Lock wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  
  -- Update contract shares
  IF v_contract.shares = p_shares THEN
    -- Delete contract if selling all
    DELETE FROM user_contracts WHERE id = p_contract_id;
  ELSE
    -- Update shares if partial sell
    UPDATE user_contracts 
    SET shares = shares - p_shares,
        total_invested = total_invested - (p_shares * average_price),
        updated_at = NOW()
    WHERE id = p_contract_id;
  END IF;
  
  -- Credit wallet
  UPDATE wallets 
  SET balance_available = balance_available + v_sale_value,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance_available INTO v_new_balance;
  
  -- Record sell transaction
  INSERT INTO transactions (
    user_id, market_id, option_id, type, position,
    shares, price_per_share, total_amount, created_at
  ) VALUES (
    p_user_id, v_contract.market_id, v_contract.option_id, 'SELL', 'NO',
    p_shares, v_no_price, v_sale_value, NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Create ledger entry
  INSERT INTO ledger_entries (
    user_id, wallet_id, ref_type, ref_id, direction,
    amount, fee_amount, net_amount, platform_revenue, status, created_at
  ) VALUES (
    p_user_id, v_wallet.id, 'TRADE', v_transaction_id::text, 'CREDIT',
    v_sale_value, 0, v_sale_value, 0, 'COMPLETED', NOW()
  ) RETURNING id INTO v_ledger_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'ledger_id', v_ledger_id,
    'shares_sold', p_shares,
    'sale_value', v_sale_value,
    'price_per_share', v_no_price,
    'new_balance', v_new_balance
  );
END;
$$;

-- 5. Update process_market_payouts to handle NO contracts
CREATE OR REPLACE FUNCTION process_market_payouts(
  p_market_id UUID, 
  p_winning_outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_market markets%ROWTYPE;
  v_wallet_id UUID;
  v_payout NUMERIC;
  v_total_payouts NUMERIC := 0;
  v_contracts_processed INTEGER := 0;
  v_contract_unit NUMERIC;
  v_is_multi_option BOOLEAN := FALSE;
  v_winning_option_id UUID := NULL;
  v_total_volume NUMERIC;
  v_rake_percent NUMERIC := 0.05; -- 5% platform rake
  v_pool_available NUMERIC;
  v_payout_ratio NUMERIC := 1.0;
  v_first_pass_payouts NUMERIC := 0;
BEGIN
  -- Get market info
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  v_contract_unit := v_market.contract_unit_cost / 100.0; -- Convert cents to BRL
  v_total_volume := v_market.total_volume;
  
  -- Determine if this is a multi-option market with UUID outcome
  IF p_winning_outcome ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_is_multi_option := TRUE;
    v_winning_option_id := p_winning_outcome::UUID;
  END IF;
  
  -- Calculate pool available after rake
  v_pool_available := v_total_volume * (1 - v_rake_percent);
  
  -- First pass: calculate total payouts to check if we need to proportionalize
  FOR v_contract IN
    SELECT uc.*, 
           COALESCE(uc.contract_type, 'YES') as ctype
    FROM user_contracts uc 
    WHERE uc.market_id = p_market_id AND uc.shares > 0
  LOOP
    IF v_is_multi_option THEN
      -- Multi-option market logic
      IF v_contract.ctype = 'YES' THEN
        -- YES contract: wins if option_id matches winner
        IF v_contract.option_id = v_winning_option_id THEN
          v_first_pass_payouts := v_first_pass_payouts + (v_contract.shares * v_contract_unit);
        END IF;
      ELSIF v_contract.ctype = 'NO' THEN
        -- NO contract: wins if option_id does NOT match winner
        IF v_contract.option_id IS DISTINCT FROM v_winning_option_id THEN
          v_first_pass_payouts := v_first_pass_payouts + (v_contract.shares * v_contract_unit);
        END IF;
      END IF;
    ELSE
      -- Binary market logic (YES/NO)
      IF (v_contract.position = 'YES' AND p_winning_outcome = 'YES') OR
         (v_contract.position = 'NO' AND p_winning_outcome = 'NO') THEN
        v_first_pass_payouts := v_first_pass_payouts + (v_contract.shares * v_contract_unit);
      END IF;
    END IF;
  END LOOP;
  
  -- Calculate payout ratio if payouts exceed pool
  IF v_first_pass_payouts > v_pool_available AND v_first_pass_payouts > 0 THEN
    v_payout_ratio := v_pool_available / v_first_pass_payouts;
    RAISE NOTICE 'Payouts exceed pool. Ratio: %, Pool: %, Payouts: %', 
                 v_payout_ratio, v_pool_available, v_first_pass_payouts;
  END IF;
  
  -- Second pass: process actual payouts
  FOR v_contract IN
    SELECT uc.*, 
           COALESCE(uc.contract_type, 'YES') as ctype
    FROM user_contracts uc 
    WHERE uc.market_id = p_market_id AND uc.shares > 0
  LOOP
    v_payout := 0;
    
    IF v_is_multi_option THEN
      -- Multi-option market payout logic
      IF v_contract.ctype = 'YES' THEN
        -- YES contract: wins if option_id matches winner
        IF v_contract.option_id = v_winning_option_id THEN
          v_payout := v_contract.shares * v_contract_unit * v_payout_ratio;
        END IF;
      ELSIF v_contract.ctype = 'NO' THEN
        -- NO contract: wins if option_id does NOT match winner
        IF v_contract.option_id IS DISTINCT FROM v_winning_option_id THEN
          v_payout := v_contract.shares * v_contract_unit * v_payout_ratio;
        END IF;
      END IF;
    ELSE
      -- Binary market payout logic
      IF (v_contract.position = 'YES' AND p_winning_outcome = 'YES') OR
         (v_contract.position = 'NO' AND p_winning_outcome = 'NO') THEN
        v_payout := v_contract.shares * v_contract_unit * v_payout_ratio;
      END IF;
    END IF;
    
    -- Process payout if there is one
    IF v_payout > 0 THEN
      -- Get or create wallet
      SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_contract.user_id;
      
      IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, balance_available, balance_locked)
        VALUES (v_contract.user_id, 0, 0)
        RETURNING id INTO v_wallet_id;
      END IF;
      
      -- Credit wallet
      UPDATE wallets 
      SET balance_available = balance_available + v_payout,
          updated_at = NOW()
      WHERE id = v_wallet_id;
      
      -- Create ledger entry
      INSERT INTO ledger_entries (
        user_id, wallet_id, ref_type, ref_id, direction,
        amount, fee_amount, net_amount, platform_revenue, status
      ) VALUES (
        v_contract.user_id, v_wallet_id, 'SETTLEMENT', p_market_id::text, 'CREDIT',
        v_payout, 0, v_payout, 0, 'COMPLETED'
      );
      
      -- Update profile stats for winners
      UPDATE profiles 
      SET winning_trades = winning_trades + 1,
          total_profit = total_profit + (v_payout - v_contract.total_invested),
          current_streak = current_streak + 1,
          best_streak = GREATEST(best_streak, current_streak + 1),
          best_trade_profit = GREATEST(best_trade_profit, v_payout - v_contract.total_invested),
          updated_at = NOW()
      WHERE id = v_contract.user_id;
      
      v_total_payouts := v_total_payouts + v_payout;
    ELSE
      -- Update profile stats for losers (reset streak)
      UPDATE profiles 
      SET current_streak = 0,
          updated_at = NOW()
      WHERE id = v_contract.user_id;
    END IF;
    
    -- Zero out contract shares (mark as settled)
    UPDATE user_contracts 
    SET shares = 0, 
        updated_at = NOW()
    WHERE id = v_contract.id;
    
    v_contracts_processed := v_contracts_processed + 1;
  END LOOP;
  
  -- Record platform revenue from rake
  IF v_total_volume > 0 THEN
    INSERT INTO platform_revenue (day, type, gross, fees, net)
    VALUES (CURRENT_DATE, 'SETTLEMENT_RAKE', v_total_volume * v_rake_percent, 0, v_total_volume * v_rake_percent)
    ON CONFLICT (day, type) DO UPDATE SET
      gross = platform_revenue.gross + EXCLUDED.gross,
      net = platform_revenue.net + EXCLUDED.net,
      updated_at = NOW();
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'contracts_processed', v_contracts_processed,
    'total_payouts', v_total_payouts,
    'pool_available', v_pool_available,
    'payout_ratio', v_payout_ratio,
    'rake_collected', v_total_volume * v_rake_percent
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION atomic_execute_multi_no_trade TO authenticated;
GRANT EXECUTE ON FUNCTION atomic_execute_multi_no_sell TO authenticated;
GRANT EXECUTE ON FUNCTION process_market_payouts TO service_role;