-- Fix SECURITY DEFINER views by recreating them with security_invoker = true
-- This ensures the view respects the RLS policies of the querying user

-- Recreate profiles_public view with security_invoker
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
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

-- Recreate wallets_with_profile view with security_invoker
DROP VIEW IF EXISTS public.wallets_with_profile;
CREATE VIEW public.wallets_with_profile
WITH (security_invoker = true) AS
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