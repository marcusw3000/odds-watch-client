-- Drop existing function to allow signature change
DROP FUNCTION IF EXISTS public.process_market_payouts(UUID, TEXT);

-- Add max_winners column to markets table
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS max_winners INTEGER DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN public.markets.max_winners IS 'Number of winning options for multi-option markets (1 = winner-takes-all)';

-- Create function for multi-winner payouts
CREATE OR REPLACE FUNCTION public.process_market_payouts(
  p_market_id UUID,
  p_winning_outcome TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_market RECORD;
  v_winners_array TEXT[];
  v_winner_count INTEGER;
  v_placement_multipliers DECIMAL[] := ARRAY[1.0, 0.6, 0.3, 0.15, 0.1];
  v_contract RECORD;
  v_payout_amount DECIMAL;
  v_total_payouts DECIMAL := 0;
  v_total_contracts INTEGER := 0;
  v_winner_contracts INTEGER := 0;
  v_no_winner_contracts INTEGER := 0;
  v_rake_rate DECIMAL := 0.005;
  v_placement INTEGER;
  v_is_winner BOOLEAN;
  v_multiplier DECIMAL;
  i INTEGER;
BEGIN
  -- Fetch market details
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Market not found');
  END IF;
  
  -- Parse winning outcome - can be single value or JSON array
  BEGIN
    -- Try to parse as JSON array first
    v_winners_array := ARRAY(SELECT jsonb_array_elements_text(p_winning_outcome::jsonb));
    v_winner_count := array_length(v_winners_array, 1);
  EXCEPTION WHEN OTHERS THEN
    -- Single winner (binary market or single option)
    v_winners_array := ARRAY[p_winning_outcome];
    v_winner_count := 1;
  END;
  
  RAISE NOTICE 'Processing payouts for market % with % winner(s): %', p_market_id, v_winner_count, v_winners_array;
  
  -- Process all active contracts for this market
  FOR v_contract IN 
    SELECT 
      uc.id,
      uc.user_id,
      uc.quantity,
      uc.position,
      uc.option_id,
      uc.contract_type,
      uc.purchase_price
    FROM user_contracts uc
    WHERE uc.market_id = p_market_id 
      AND uc.status = 'ACTIVE'
  LOOP
    v_total_contracts := v_total_contracts + 1;
    v_payout_amount := 0;
    v_is_winner := FALSE;
    v_placement := 0;
    v_multiplier := 0;
    
    -- Determine if this contract wins and at what placement
    IF v_market.market_type = 'BINARY' THEN
      -- Binary market logic (YES/NO)
      IF v_contract.position = v_winners_array[1] THEN
        v_is_winner := TRUE;
        v_multiplier := 1.0;
        v_winner_contracts := v_winner_contracts + 1;
      END IF;
    ELSE
      -- Multi-option market logic
      IF v_contract.position = 'OPTION' AND v_contract.option_id IS NOT NULL THEN
        -- Check if this option is in the winners array
        FOR v_placement IN 1..v_winner_count LOOP
          IF v_contract.option_id::text = v_winners_array[v_placement] THEN
            -- YES contract on a winning option
            IF COALESCE(v_contract.contract_type, 'YES') = 'YES' THEN
              v_is_winner := TRUE;
              v_multiplier := COALESCE(v_placement_multipliers[v_placement], 0.1);
              v_winner_contracts := v_winner_contracts + 1;
              EXIT;
            END IF;
          END IF;
        END LOOP;
        
        -- NO contract logic: wins if option is NOT in any placement
        IF COALESCE(v_contract.contract_type, 'YES') = 'NO' THEN
          v_is_winner := TRUE;
          FOR i IN 1..v_winner_count LOOP
            IF v_contract.option_id::text = v_winners_array[i] THEN
              v_is_winner := FALSE;
              EXIT;
            END IF;
          END LOOP;
          IF v_is_winner THEN
            v_multiplier := 1.0;
            v_no_winner_contracts := v_no_winner_contracts + 1;
          END IF;
        END IF;
      END IF;
    END IF;
    
    -- Calculate and apply payout
    IF v_is_winner AND v_multiplier > 0 THEN
      -- Calculate raw payout: quantity * R$1 (contract unit) * multiplier
      v_payout_amount := v_contract.quantity * 1.0 * v_multiplier;
      
      -- Apply rake
      v_payout_amount := v_payout_amount * (1 - v_rake_rate);
      
      v_total_payouts := v_total_payouts + v_payout_amount;
      
      -- Credit user wallet
      UPDATE wallets 
      SET balance_available = balance_available + v_payout_amount,
          updated_at = NOW()
      WHERE user_id = v_contract.user_id;
      
      -- Update contract status to WON
      UPDATE user_contracts 
      SET status = 'WON', 
          payout = v_payout_amount,
          updated_at = NOW()
      WHERE id = v_contract.id;
      
      -- Create ledger entry
      INSERT INTO ledger_entries (
        user_id,
        wallet_id,
        ref_type,
        ref_id,
        direction,
        amount,
        net_amount,
        fee_amount,
        platform_revenue,
        status,
        meta
      ) 
      SELECT 
        v_contract.user_id,
        w.id,
        'SETTLEMENT',
        v_contract.id,
        'CREDIT',
        v_payout_amount,
        v_payout_amount,
        v_payout_amount * v_rake_rate / (1 - v_rake_rate),
        v_payout_amount * v_rake_rate / (1 - v_rake_rate),
        'COMPLETED',
        jsonb_build_object(
          'market_id', p_market_id,
          'contract_type', COALESCE(v_contract.contract_type, 'YES'),
          'position', v_contract.position,
          'option_id', v_contract.option_id,
          'placement', v_placement,
          'multiplier', v_multiplier,
          'quantity', v_contract.quantity
        )
      FROM wallets w
      WHERE w.user_id = v_contract.user_id;
      
      -- Update user stats
      UPDATE profiles
      SET winning_trades = winning_trades + 1,
          total_profit = total_profit + v_payout_amount - (v_contract.quantity * COALESCE(v_contract.purchase_price, 0.5)),
          current_streak = current_streak + 1,
          best_streak = GREATEST(best_streak, current_streak + 1),
          updated_at = NOW()
      WHERE id = v_contract.user_id;
      
    ELSE
      -- Mark contract as LOST
      UPDATE user_contracts 
      SET status = 'LOST', 
          payout = 0,
          updated_at = NOW()
      WHERE id = v_contract.id;
      
      -- Reset streak for losers
      UPDATE profiles
      SET current_streak = 0,
          updated_at = NOW()
      WHERE id = v_contract.user_id;
    END IF;
  END LOOP;
  
  -- Send settlement notifications
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT DISTINCT
    uc.user_id,
    'MARKET_SETTLED',
    'Mercado Liquidado',
    CASE 
      WHEN uc.status = 'WON' THEN 'Você ganhou R$ ' || ROUND(uc.payout::numeric, 2) || ' no mercado "' || v_market.title || '"!'
      ELSE 'O mercado "' || v_market.title || '" foi liquidado.'
    END,
    jsonb_build_object(
      'market_id', p_market_id,
      'market_title', v_market.title,
      'result', p_winning_outcome,
      'status', uc.status,
      'payout', uc.payout
    )
  FROM user_contracts uc
  WHERE uc.market_id = p_market_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'market_id', p_market_id,
    'winning_outcome', p_winning_outcome,
    'winners_count', v_winner_count,
    'total_contracts', v_total_contracts,
    'winner_contracts', v_winner_contracts,
    'no_winner_contracts', v_no_winner_contracts,
    'total_payouts', v_total_payouts,
    'rake_rate', v_rake_rate
  );
END;
$$;