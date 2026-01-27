-- Create table to store market price history
CREATE TABLE public.market_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  yes_price NUMERIC(10, 4) NOT NULL,
  no_price NUMERIC(10, 4) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'trade'
);

-- Index for fast queries by market and date
CREATE INDEX idx_market_price_history_market_date 
  ON public.market_price_history(market_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

-- Public read policy (anyone can view price history)
CREATE POLICY "Anyone can read price history" 
  ON public.market_price_history 
  FOR SELECT 
  USING (true);

-- Function to record price after each trade
CREATE OR REPLACE FUNCTION public.record_price_after_trade()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for BUY/SELL transactions with a market_id
  IF NEW.type IN ('BUY', 'SELL') AND NEW.market_id IS NOT NULL THEN
    INSERT INTO public.market_price_history (market_id, yes_price, no_price, source)
    SELECT 
      NEW.market_id,
      current_yes_price,
      current_no_price,
      'trade'
    FROM public.markets 
    WHERE id = NEW.market_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically record price after each transaction
CREATE TRIGGER trigger_record_price_after_trade
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.record_price_after_trade();