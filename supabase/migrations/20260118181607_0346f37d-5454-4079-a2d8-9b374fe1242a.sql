-- Helper function to increment trader followers
CREATE OR REPLACE FUNCTION increment_trader_followers(trader_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE copy_traders 
  SET 
    total_followers = total_followers + 1,
    updated_at = now()
  WHERE id = trader_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_trader_followers TO authenticated;