-- Add contract unit cost column (value paid per winning contract)
ALTER TABLE public.markets
ADD COLUMN contract_unit_cost numeric NOT NULL DEFAULT 100;