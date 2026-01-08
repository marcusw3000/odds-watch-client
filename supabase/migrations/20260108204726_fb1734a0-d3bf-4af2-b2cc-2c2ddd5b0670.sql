-- Create table for market options (multiple outcomes per market)
CREATE TABLE public.market_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  shares NUMERIC NOT NULL DEFAULT 0,
  current_price NUMERIC NOT NULL DEFAULT 0.5,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add market_type column to markets table
ALTER TABLE public.markets 
ADD COLUMN market_type TEXT NOT NULL DEFAULT 'BINARY',
ADD COLUMN options_exclusive BOOLEAN NOT NULL DEFAULT true;

-- Add option_id to user_contracts and transactions
ALTER TABLE public.user_contracts
ADD COLUMN option_id UUID REFERENCES public.market_options(id) ON DELETE CASCADE;

ALTER TABLE public.transactions
ADD COLUMN option_id UUID REFERENCES public.market_options(id) ON DELETE CASCADE;

-- Enable RLS on market_options
ALTER TABLE public.market_options ENABLE ROW LEVEL SECURITY;

-- Policies for market_options
CREATE POLICY "Market options are publicly readable" 
ON public.market_options 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage market options" 
ON public.market_options 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better performance
CREATE INDEX idx_market_options_market_id ON public.market_options(market_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_market_options_updated_at
BEFORE UPDATE ON public.market_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();