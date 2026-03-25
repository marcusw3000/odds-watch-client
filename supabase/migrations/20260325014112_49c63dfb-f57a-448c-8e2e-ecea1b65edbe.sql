CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
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
  CASE WHEN show_profit THEN total_profit ELSE NULL END AS total_profit,
  CASE WHEN show_roi THEN roi_percent ELSE NULL END AS roi_percent,
  CASE WHEN show_volume THEN total_volume ELSE NULL END AS total_volume,
  CASE WHEN show_trades THEN total_trades ELSE NULL END AS total_trades,
  CASE WHEN show_trades THEN winning_trades ELSE NULL END AS winning_trades,
  current_streak,
  best_streak,
  CASE WHEN show_profit THEN best_trade_profit ELSE NULL END AS best_trade_profit,
  created_at,
  updated_at,
  is_copy_trader
FROM profiles
WHERE is_public = true AND display_name IS NOT NULL AND display_name <> '';