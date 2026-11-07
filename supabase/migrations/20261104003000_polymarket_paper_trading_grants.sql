-- RLS limits rows to auth.uid(); these grants allow the authenticated client
-- to read its own simulated positions and history.
GRANT SELECT ON public.polymarket_paper_wallets, public.polymarket_paper_positions, public.polymarket_paper_trades TO authenticated;
