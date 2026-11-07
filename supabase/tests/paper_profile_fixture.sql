-- Minimal schema for testing paper-profile migrations in a disposable PostgreSQL instance.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id), display_name text, avatar_url text,
  is_public boolean NOT NULL DEFAULT true, show_profit boolean NOT NULL DEFAULT true,
  show_roi boolean NOT NULL DEFAULT true, show_volume boolean NOT NULL DEFAULT true,
  show_trades boolean NOT NULL DEFAULT true
);
CREATE TABLE public.polymarket_market_cache (
  source text NOT NULL, market_id text NOT NULL, question text NOT NULL, PRIMARY KEY(source,market_id)
);
