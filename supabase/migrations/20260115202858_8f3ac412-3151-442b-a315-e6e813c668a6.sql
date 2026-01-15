-- Corrigir view para usar SECURITY INVOKER (padrão seguro)
DROP VIEW IF EXISTS public.wallets_with_profile;
CREATE VIEW public.wallets_with_profile 
WITH (security_invoker = on)
AS
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
  p.email,
  p.full_name,
  p.display_name
FROM public.wallets w
LEFT JOIN public.profiles p ON w.user_id = p.id;