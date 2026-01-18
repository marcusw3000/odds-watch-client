-- Add card_style column to markets table for individual card styling
ALTER TABLE public.markets 
ADD COLUMN card_style text DEFAULT 'default';

-- Add comment for documentation
COMMENT ON COLUMN public.markets.card_style IS 'Visual style for the market card: default, buttons, simple, minimal';