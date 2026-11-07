BEGIN;
INSERT INTO public.polymarket_market_cache (market_id, outcomes) VALUES
  ('low', '[{"label":"Yes","price":"0.001"},{"label":"No","price":"0.999"}]'),
  ('high', '[{"label":"No","price":"0.7"},{"label":"Yes","price":"0.3"}]'),
  ('invalid', '[{"label":"Yes","price":"99"}]'),
  ('fallback', '[{"label":"Alpha","price":0.2},{"label":"Beta","price":0.8}]'),
  ('missing', NULL);
DO $$
DECLARE ids text[];
BEGIN
  IF (SELECT public.polymarket_preview_probability(m) FROM public.polymarket_market_cache m WHERE market_id='high') <> 0.3 THEN RAISE EXCEPTION 'Yes outcome not selected'; END IF;
  IF (SELECT public.polymarket_preview_probability(m) FROM public.polymarket_market_cache m WHERE market_id='fallback') <> 0.2 THEN RAISE EXCEPTION 'first outcome fallback failed'; END IF;
  IF (SELECT public.polymarket_preview_probability(m) FROM public.polymarket_market_cache m WHERE market_id='invalid') IS NOT NULL THEN RAISE EXCEPTION 'invalid probability accepted'; END IF;
  IF (SELECT public.polymarket_preview_probability(m) FROM public.polymarket_market_cache m WHERE market_id='missing') IS NOT NULL THEN RAISE EXCEPTION 'missing outcomes accepted'; END IF;
  SELECT array_agg(market_id) INTO ids FROM (SELECT m.market_id FROM public.polymarket_market_cache m ORDER BY public.polymarket_preview_probability(m) DESC NULLS LAST, market_id LIMIT 2) ranked;
  IF ids <> ARRAY['high','fallback'] THEN RAISE EXCEPTION 'incorrect ordering'; END IF;
  IF NOT has_function_privilege('anon', 'public.polymarket_preview_probability(public.polymarket_market_cache)', 'EXECUTE') THEN RAISE EXCEPTION 'public read unavailable'; END IF;
END $$;
ROLLBACK;
