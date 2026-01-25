-- Fix search_path for calculate_multi_lmsr_cost
CREATE OR REPLACE FUNCTION public.calculate_multi_lmsr_cost(shares numeric[], b numeric)
RETURNS numeric AS $$
DECLARE
  max_val numeric;
  sum_exp numeric := 0;
  i integer;
BEGIN
  IF array_length(shares, 1) IS NULL OR array_length(shares, 1) = 0 THEN
    RETURN 0;
  END IF;
  
  max_val := shares[1] / b;
  FOR i IN 2..array_length(shares, 1) LOOP
    IF shares[i] / b > max_val THEN
      max_val := shares[i] / b;
    END IF;
  END LOOP;
  
  FOR i IN 1..array_length(shares, 1) LOOP
    sum_exp := sum_exp + exp((shares[i] / b) - max_val);
  END LOOP;
  
  RETURN b * (max_val + ln(sum_exp));
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public';

-- Fix search_path for calculate_multi_lmsr_prices
CREATE OR REPLACE FUNCTION public.calculate_multi_lmsr_prices(shares numeric[], b numeric)
RETURNS numeric[] AS $$
DECLARE
  max_val numeric;
  exp_values numeric[];
  sum_exp numeric := 0;
  prices numeric[];
  i integer;
BEGIN
  IF array_length(shares, 1) IS NULL OR array_length(shares, 1) = 0 THEN
    RETURN ARRAY[]::numeric[];
  END IF;
  
  max_val := shares[1] / b;
  FOR i IN 2..array_length(shares, 1) LOOP
    IF shares[i] / b > max_val THEN
      max_val := shares[i] / b;
    END IF;
  END LOOP;
  
  FOR i IN 1..array_length(shares, 1) LOOP
    exp_values[i] := exp((shares[i] / b) - max_val);
    sum_exp := sum_exp + exp_values[i];
  END LOOP;
  
  FOR i IN 1..array_length(shares, 1) LOOP
    prices[i] := LEAST(99, GREATEST(1, round((exp_values[i] / sum_exp) * 100)));
  END LOOP;
  
  RETURN prices;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public';