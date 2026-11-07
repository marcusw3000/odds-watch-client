-- External favorites deliberately use source + external identifier instead of
-- `user_favorites.market_id`, which belongs to the local LMSR domain.
CREATE TABLE IF NOT EXISTS public.polymarket_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'polymarket' CHECK (source = 'polymarket'),
  market_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source, market_id)
);

CREATE INDEX IF NOT EXISTS polymarket_favorites_user_created_at_idx
  ON public.polymarket_favorites (user_id, created_at DESC);

ALTER TABLE public.polymarket_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own Polymarket favorites"
  ON public.polymarket_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own Polymarket favorites"
  ON public.polymarket_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own Polymarket favorites"
  ON public.polymarket_favorites FOR DELETE
  USING (auth.uid() = user_id);
