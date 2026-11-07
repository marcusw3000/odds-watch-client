-- Virtual USD only. This schema has no link to BRL wallets, payments, or CLOB orders.
CREATE TABLE public.polymarket_paper_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_usd numeric(18,6) NOT NULL DEFAULT 10000 CHECK (balance_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.polymarket_paper_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id text NOT NULL,
  market_question text NOT NULL,
  outcome_label text NOT NULL,
  outcome_token_id text,
  shares numeric(18,6) NOT NULL CHECK (shares > 0),
  average_price numeric(18,6) NOT NULL CHECK (average_price > 0 AND average_price <= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, market_id, outcome_label)
);

CREATE TABLE public.polymarket_paper_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id text NOT NULL,
  outcome_label text NOT NULL,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  price numeric(18,6) NOT NULL CHECK (price > 0 AND price <= 1),
  shares numeric(18,6) NOT NULL CHECK (shares > 0),
  notional_usd numeric(18,6) NOT NULL CHECK (notional_usd > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX polymarket_paper_positions_user_idx ON public.polymarket_paper_positions (user_id, updated_at DESC);
CREATE INDEX polymarket_paper_trades_user_idx ON public.polymarket_paper_trades (user_id, created_at DESC);

ALTER TABLE public.polymarket_paper_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polymarket_paper_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polymarket_paper_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own paper wallet" ON public.polymarket_paper_wallets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own paper positions" ON public.polymarket_paper_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own paper trades" ON public.polymarket_paper_trades FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_polymarket_paper_wallet()
RETURNS public.polymarket_paper_wallets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wallet public.polymarket_paper_wallets;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO polymarket_paper_wallets (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO wallet FROM polymarket_paper_wallets WHERE user_id = auth.uid();
  RETURN wallet;
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_polymarket_paper_trade(p_market_id text, p_market_question text, p_outcome_label text, p_outcome_token_id text, p_side text, p_price numeric, p_shares numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cost numeric; position public.polymarket_paper_positions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_side NOT IN ('BUY', 'SELL') OR p_price <= 0 OR p_price > 1 OR p_shares <= 0 THEN RAISE EXCEPTION 'Invalid paper trade'; END IF;
  INSERT INTO polymarket_paper_wallets (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  cost := round(p_price * p_shares, 6);
  SELECT * INTO position FROM polymarket_paper_positions WHERE user_id=uid AND market_id=p_market_id AND outcome_label=p_outcome_label FOR UPDATE;
  IF p_side = 'BUY' THEN
    UPDATE polymarket_paper_wallets SET balance_usd = balance_usd - cost, updated_at=now() WHERE user_id=uid AND balance_usd >= cost;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient paper balance'; END IF;
    INSERT INTO polymarket_paper_positions (user_id,market_id,market_question,outcome_label,outcome_token_id,shares,average_price)
    VALUES (uid,p_market_id,p_market_question,p_outcome_label,p_outcome_token_id,p_shares,p_price)
    ON CONFLICT (user_id,market_id,outcome_label) DO UPDATE SET shares=polymarket_paper_positions.shares+EXCLUDED.shares, average_price=((polymarket_paper_positions.shares*polymarket_paper_positions.average_price)+(EXCLUDED.shares*EXCLUDED.average_price))/(polymarket_paper_positions.shares+EXCLUDED.shares), updated_at=now();
  ELSE
    IF NOT FOUND OR position.shares < p_shares THEN RAISE EXCEPTION 'Insufficient paper shares'; END IF;
    UPDATE polymarket_paper_wallets SET balance_usd=balance_usd+cost, updated_at=now() WHERE user_id=uid;
    IF position.shares = p_shares THEN DELETE FROM polymarket_paper_positions WHERE id=position.id; ELSE UPDATE polymarket_paper_positions SET shares=shares-p_shares, updated_at=now() WHERE id=position.id; END IF;
  END IF;
  INSERT INTO polymarket_paper_trades (user_id,market_id,outcome_label,side,price,shares,notional_usd) VALUES (uid,p_market_id,p_outcome_label,p_side,p_price,p_shares,cost);
  RETURN jsonb_build_object('success',true,'notional_usd',cost);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_polymarket_paper_wallet()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM polymarket_paper_positions WHERE user_id=auth.uid();
  DELETE FROM polymarket_paper_trades WHERE user_id=auth.uid();
  INSERT INTO polymarket_paper_wallets (user_id,balance_usd) VALUES (auth.uid(),10000) ON CONFLICT (user_id) DO UPDATE SET balance_usd=10000,updated_at=now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_polymarket_paper_wallet(), public.execute_polymarket_paper_trade(text,text,text,text,text,numeric,numeric), public.reset_polymarket_paper_wallet() TO authenticated;
