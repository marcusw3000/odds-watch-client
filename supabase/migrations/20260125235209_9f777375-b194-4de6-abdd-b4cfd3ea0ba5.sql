-- Create a test multi-option market
DO $$
DECLARE
  v_market_id uuid;
  v_lmsr_b numeric := 100;
  v_shares_a numeric;
  v_shares_b numeric;
  v_shares_c numeric;
BEGIN
  -- Insert the market
  INSERT INTO public.markets (
    title,
    description,
    category,
    status,
    close_date,
    settlement_date,
    market_type,
    lmsr_b,
    current_yes_price,
    current_no_price,
    yes_shares,
    no_shares,
    options_exclusive,
    settlement_type,
    tags
  ) VALUES (
    'Teste LMSR: Quem será o próximo campeão?',
    'Mercado de teste para validar o trading multi-opção com 3 candidatos. Cada opção representa um competidor diferente.',
    'esportes',
    'OPEN',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '14 days',
    'MULTIPLE',
    v_lmsr_b,
    0, -- Not used for MULTIPLE
    0, -- Not used for MULTIPLE
    0, -- Not used for MULTIPLE
    0, -- Not used for MULTIPLE
    true,
    'MANUAL',
    ARRAY['teste', 'lmsr', 'multi-opção']
  ) RETURNING id INTO v_market_id;

  -- Calculate initial shares for LMSR based on target probabilities
  -- Option A: 40%, Option B: 35%, Option C: 25%
  -- Using formula: qi = b * ln(Pi / Pref) where Pref = 1/n for reference
  v_shares_a := v_lmsr_b * ln(0.40 / (1.0/3.0));  -- ~18.23
  v_shares_b := v_lmsr_b * ln(0.35 / (1.0/3.0));  -- ~4.88
  v_shares_c := v_lmsr_b * ln(0.25 / (1.0/3.0));  -- ~-28.77

  -- Insert the 3 options
  INSERT INTO public.market_options (market_id, label, description, shares, current_price, display_order, image_url)
  VALUES 
    (v_market_id, 'Competidor Alpha', 'O favorito da competição com histórico forte', v_shares_a, 0.40, 0, NULL),
    (v_market_id, 'Competidor Beta', 'Azarão com potencial de surpreender', v_shares_b, 0.35, 1, NULL),
    (v_market_id, 'Competidor Gamma', 'Novato promissor mas inexperiente', v_shares_c, 0.25, 2, NULL);

  RAISE NOTICE 'Created market % with 3 options', v_market_id;
END $$;