-- RLS bypass does not itself grant table privileges to the Edge Function role.
GRANT SELECT ON TABLE public.polymarket_event_cache TO service_role;
