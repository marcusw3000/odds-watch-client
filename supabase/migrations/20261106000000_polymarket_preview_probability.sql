-- PostgREST computed field for ordering each event's cached markets by the
-- displayed Yes price. This does not reorder events or alter their data.
CREATE FUNCTION public.polymarket_preview_probability(public.polymarket_market_cache)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN length(price) <= 32 AND price ~ '^(0([.][0-9]+)?|1([.]0+)?|[.][0-9]+)$' THEN price::numeric
    ELSE NULL
  END
  FROM (
    SELECT item ->> 'price' AS price
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(($1).outcomes) = 'array' THEN ($1).outcomes ELSE '[]'::jsonb END)
      WITH ORDINALITY AS outcome(item, position)
    WHERE jsonb_typeof(item) = 'object'
    ORDER BY CASE WHEN lower(coalesce(item ->> 'label', '')) = 'yes' THEN 0 ELSE 1 END, position
    LIMIT 1
  ) selected;
$$;
GRANT EXECUTE ON FUNCTION public.polymarket_preview_probability(public.polymarket_market_cache) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
