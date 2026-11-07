-- RLS continues to limit updates to the caller's own profile.
-- Administrative and financial statistics remain non-writable by the caller.
GRANT UPDATE (display_name, bio, is_public, show_profit, show_roi, show_volume, show_trades)
  ON public.profiles TO authenticated;
NOTIFY pgrst, 'reload schema';
