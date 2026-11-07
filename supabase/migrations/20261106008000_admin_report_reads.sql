-- Existing RLS limits chat report reads to administrators.
GRANT SELECT ON public.chat_reports TO authenticated;
NOTIFY pgrst, 'reload schema';
