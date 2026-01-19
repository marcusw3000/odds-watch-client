-- Recalculate winning_trades from historical PAYOUT transactions
-- Also recalculate total_profit based on settlement payouts

-- First, reset winning_trades to recalculate from scratch
UPDATE profiles SET winning_trades = 0 WHERE winning_trades IS NULL OR winning_trades >= 0;

-- Count all PAYOUT transactions per user and update winning_trades
UPDATE profiles p SET
  winning_trades = sub.payout_count
FROM (
  SELECT 
    user_id, 
    COUNT(*) as payout_count
  FROM transactions 
  WHERE type = 'PAYOUT'
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id;

-- Recalculate total_profit based on PAYOUT transactions minus original BUY investments
-- For each market where user had a PAYOUT, calculate: payout_amount - original_investment
UPDATE profiles p SET
  total_profit = sub.calculated_profit
FROM (
  SELECT 
    t_payout.user_id,
    SUM(t_payout.total_amount - COALESCE(uc.total_invested, 0)) as calculated_profit
  FROM transactions t_payout
  JOIN user_contracts uc ON uc.user_id = t_payout.user_id 
    AND uc.market_id = t_payout.market_id 
    AND uc.position = t_payout.position
  WHERE t_payout.type = 'PAYOUT'
  GROUP BY t_payout.user_id
) sub
WHERE p.id = sub.user_id;

-- Recalculate ROI percent for users with volume
UPDATE profiles SET
  roi_percent = CASE 
    WHEN COALESCE(total_volume, 0) > 0 
    THEN (COALESCE(total_profit, 0) / total_volume) * 100 
    ELSE 0 
  END
WHERE total_volume > 0;