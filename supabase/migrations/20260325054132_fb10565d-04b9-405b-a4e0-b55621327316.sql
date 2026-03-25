
-- Add option_id column to market_price_history
ALTER TABLE public.market_price_history 
ADD COLUMN option_id uuid REFERENCES public.market_options(id) ON DELETE CASCADE;

-- Create index for efficient queries
CREATE INDEX idx_market_price_history_option 
ON public.market_price_history(market_id, option_id, recorded_at);

-- Update trigger to also record per-option prices for multi-option markets
CREATE OR REPLACE FUNCTION record_price_after_trade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market_type text;
  v_opt RECORD;
BEGIN
  IF NEW.type IN ('BUY', 'SELL') AND NEW.market_id IS NOT NULL THEN
    -- Always record the binary market-level price
    INSERT INTO public.market_price_history (market_id, yes_price, no_price, source)
    SELECT NEW.market_id, current_yes_price, current_no_price, 'trade'
    FROM public.markets WHERE id = NEW.market_id;

    -- For MULTIPLE markets, also record each option's price
    SELECT market_type INTO v_market_type FROM public.markets WHERE id = NEW.market_id;
    
    IF v_market_type = 'MULTIPLE' THEN
      FOR v_opt IN 
        SELECT id, current_price FROM public.market_options WHERE market_id = NEW.market_id
      LOOP
        INSERT INTO public.market_price_history (market_id, option_id, yes_price, no_price, source)
        VALUES (NEW.market_id, v_opt.id, v_opt.current_price, 1.0 - v_opt.current_price, 'trade');
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
