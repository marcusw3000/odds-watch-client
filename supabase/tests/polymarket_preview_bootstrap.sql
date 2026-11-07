-- Fixture for an isolated PostgreSQL container, not a Supabase project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.polymarket_market_cache (market_id text, outcomes jsonb);
