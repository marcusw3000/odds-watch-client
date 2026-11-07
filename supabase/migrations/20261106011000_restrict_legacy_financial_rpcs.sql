-- These internal routines trust user IDs and values supplied by their caller.
-- They must never be callable by anonymous or ordinary authenticated clients.
REVOKE ALL ON FUNCTION public.atomic_deposit_balance(uuid,numeric),
  public.atomic_withdraw_balance(uuid,numeric),
  public.check_pending_withdrawal(uuid,numeric,text),
  public.notify_admins(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_deposit_balance(uuid,numeric),
  public.atomic_withdraw_balance(uuid,numeric),
  public.check_pending_withdrawal(uuid,numeric,text),
  public.notify_admins(text,text,text,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
