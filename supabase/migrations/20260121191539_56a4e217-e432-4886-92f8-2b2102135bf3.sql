-- Update profiles_public view to include is_copy_trader column
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
    total_profit,
    roi_percent,
    total_volume,
    total_trades,
    winning_trades,
    current_streak,
    best_streak,
    best_trade_profit,
    created_at,
    updated_at,
    is_copy_trader
FROM profiles
WHERE is_public = true 
  AND display_name IS NOT NULL 
  AND display_name <> '';