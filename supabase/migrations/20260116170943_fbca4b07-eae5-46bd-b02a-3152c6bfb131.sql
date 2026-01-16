-- Add tags column to markets table
ALTER TABLE public.markets 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for tag queries
CREATE INDEX IF NOT EXISTS idx_markets_tags ON public.markets USING GIN(tags);