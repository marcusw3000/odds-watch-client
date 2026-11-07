-- RLS continues to restrict each operation to the authenticated user's rows.
REVOKE ALL ON public.polymarket_favorites FROM anon;
GRANT SELECT, INSERT, DELETE ON public.polymarket_favorites TO authenticated;
