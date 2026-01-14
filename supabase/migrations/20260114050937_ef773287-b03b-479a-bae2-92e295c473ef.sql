-- Recreate view as SECURITY INVOKER to avoid definer behavior
DROP VIEW IF EXISTS public.wallets_with_profile;

CREATE VIEW public.wallets_with_profile
WITH (security_invoker = true)
AS
SELECT 
  w.id,
  w.user_id,
  w.balance_available,
  w.balance_locked,
  w.currency,
  w.created_at,
  w.updated_at,
  p.email,
  p.full_name
FROM public.wallets w
LEFT JOIN public.profiles p ON w.user_id = p.id;