-- Parte 1: Adicionar novos campos na tabela profiles para rastrear conquistas
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS markets_won_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_markets_won_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_night_trade boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_early_trade boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekend_trades integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_speed_trade boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_contrarian_trade boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_referrals integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activated_referrals integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_referral_commission numeric DEFAULT 0;

-- Parte 2: Inserir novas conquistas especiais
INSERT INTO achievements (code, name, description, icon, category, points, is_active) VALUES
  ('prophet_3', 'Profeta', 'Acertou 3 mercados seguidos', '🔮', 'special', 30, true),
  ('prophet_5', 'Oráculo', 'Acertou 5 mercados seguidos', '🧙', 'special', 50, true),
  ('prophet_10', 'Vidente Supremo', 'Acertou 10 mercados seguidos', '👁️', 'special', 100, true),
  ('night_owl', 'Coruja Noturna', 'Fez trade entre 00h e 05h', '🦉', 'special', 20, true),
  ('early_bird', 'Madrugador', 'Fez trade entre 05h e 07h', '🌅', 'special', 20, true),
  ('weekend_warrior', 'Guerreiro de Fim de Semana', 'Fez 10 trades no fim de semana', '⚔️', 'special', 25, true),
  ('speed_trader', 'Trader Relâmpago', 'Comprou e vendeu em menos de 1h', '⚡', 'special', 15, true),
  ('contrarian', 'Contra a Maré', 'Comprou quando preço estava abaixo de 20%', '🌊', 'special', 25, true)
ON CONFLICT (code) DO NOTHING;

-- Parte 3: Inserir conquistas de indicação
INSERT INTO achievements (code, name, description, icon, category, points, is_active) VALUES
  ('referral_first', 'Primeiro Amigo', 'Indicou sua primeira pessoa', '👋', 'referral', 15, true),
  ('referral_5', 'Influenciador', 'Indicou 5 pessoas', '📢', 'referral', 30, true),
  ('referral_10', 'Embaixador', 'Indicou 10 pessoas', '🎖️', 'referral', 50, true),
  ('referral_25', 'Líder de Comunidade', 'Indicou 25 pessoas', '👑', 'referral', 100, true),
  ('referral_activated_5', 'Mentor', '5 indicados fizeram depósito', '🎓', 'referral', 40, true),
  ('referral_earnings_100', 'Comissão Bronze', 'Ganhou R$100 em comissões', '🥉', 'referral', 35, true),
  ('referral_earnings_500', 'Comissão Prata', 'Ganhou R$500 em comissões', '🥈', 'referral', 75, true),
  ('referral_earnings_1000', 'Comissão Ouro', 'Ganhou R$1000 em comissões', '🥇', 'referral', 150, true)
ON CONFLICT (code) DO NOTHING;

-- Parte 4: Atualizar atomic_execute_trade para rastrear condições especiais
CREATE OR REPLACE FUNCTION public.atomic_execute_trade(p_user_id uuid, p_market_id uuid, p_outcome text, p_shares numeric, p_max_cost numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_market RECORD;
  v_b numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_trade_cost numeric;
  v_new_yes_shares numeric;
  v_new_no_shares numeric;
  v_new_yes_price numeric;
  v_new_no_price numeric;
  v_wallet_id uuid;
  v_contract_id uuid;
  v_transaction_id uuid;
  v_ledger_id uuid;
  v_existing_contract RECORD;
  v_price_per_share numeric;
  v_current_hour integer;
  v_current_dow integer;
  v_is_night boolean;
  v_is_early boolean;
  v_is_weekend boolean;
  v_is_contrarian boolean;
  v_current_price numeric;
BEGIN
  SELECT * INTO v_wallet 
  FROM wallets 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  SELECT * INTO v_market 
  FROM markets 
  WHERE id = p_market_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market is not open for trading');
  END IF;
  
  v_b := v_market.lmsr_b;
  v_old_cost := v_b * ln(exp(v_market.yes_shares / v_b) + exp(v_market.no_shares / v_b));
  
  IF p_outcome = 'YES' THEN
    v_new_yes_shares := v_market.yes_shares + p_shares;
    v_new_no_shares := v_market.no_shares;
    v_current_price := v_market.current_yes_price;
  ELSE
    v_new_yes_shares := v_market.yes_shares;
    v_new_no_shares := v_market.no_shares + p_shares;
    v_current_price := v_market.current_no_price;
  END IF;
  
  v_new_cost := v_b * ln(exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_trade_cost := v_new_cost - v_old_cost;
  
  IF v_trade_cost > p_max_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price exceeded maximum cost (slippage protection)');
  END IF;
  
  IF v_wallet.balance_available < v_trade_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  v_new_yes_price := exp(v_new_yes_shares / v_b) / (exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_new_no_price := 1 - v_new_yes_price;
  v_price_per_share := v_trade_cost / p_shares;
  
  -- Verificar condições especiais para conquistas
  v_current_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo');
  v_current_dow := EXTRACT(DOW FROM now() AT TIME ZONE 'America/Sao_Paulo');
  
  -- Night owl: trade entre 00h e 05h
  v_is_night := v_current_hour >= 0 AND v_current_hour < 5;
  
  -- Early bird: trade entre 05h e 07h
  v_is_early := v_current_hour >= 5 AND v_current_hour < 7;
  
  -- Weekend warrior: fim de semana (0 = domingo, 6 = sábado)
  v_is_weekend := v_current_dow IN (0, 6);
  
  -- Contrarian: comprou quando preço estava abaixo de 20%
  v_is_contrarian := v_current_price < 0.20;
  
  UPDATE markets SET
    yes_shares = v_new_yes_shares,
    no_shares = v_new_no_shares,
    current_yes_price = v_new_yes_price,
    current_no_price = v_new_no_price,
    total_volume = total_volume + v_trade_cost,
    updated_at = now()
  WHERE id = p_market_id;
  
  UPDATE wallets SET
    balance_available = balance_available - v_trade_cost,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
  ) VALUES (
    p_user_id, v_wallet.id, v_trade_cost, v_trade_cost, 'DEBIT', 'TRADE', p_market_id, 'COMPLETED'
  ) RETURNING id INTO v_ledger_id;
  
  INSERT INTO transactions (
    user_id, market_id, type, position, shares, price_per_share, total_amount
  ) VALUES (
    p_user_id, p_market_id, 'BUY', p_outcome, p_shares, v_price_per_share, v_trade_cost
  ) RETURNING id INTO v_transaction_id;
  
  SELECT * INTO v_existing_contract
  FROM user_contracts
  WHERE user_id = p_user_id AND market_id = p_market_id AND position = p_outcome
  FOR UPDATE;
  
  IF FOUND THEN
    UPDATE user_contracts SET
      shares = v_existing_contract.shares + p_shares,
      total_invested = v_existing_contract.total_invested + v_trade_cost,
      average_price = (v_existing_contract.total_invested + v_trade_cost) / (v_existing_contract.shares + p_shares),
      updated_at = now()
    WHERE id = v_existing_contract.id
    RETURNING id INTO v_contract_id;
  ELSE
    INSERT INTO user_contracts (
      user_id, market_id, position, shares, average_price, total_invested
    ) VALUES (
      p_user_id, p_market_id, p_outcome, p_shares, v_price_per_share, v_trade_cost
    ) RETURNING id INTO v_contract_id;
  END IF;
  
  -- Atualizar estatísticas do usuário incluindo conquistas especiais
  UPDATE profiles SET
    total_trades = COALESCE(total_trades, 0) + 1,
    total_volume = COALESCE(total_volume, 0) + v_trade_cost,
    has_night_trade = has_night_trade OR v_is_night,
    has_early_trade = has_early_trade OR v_is_early,
    weekend_trades = CASE WHEN v_is_weekend THEN COALESCE(weekend_trades, 0) + 1 ELSE COALESCE(weekend_trades, 0) END,
    has_contrarian_trade = has_contrarian_trade OR v_is_contrarian,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Verificar e conceder conquistas
  PERFORM check_and_grant_achievements(p_user_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'trade_cost', v_trade_cost,
    'shares', p_shares,
    'price_per_share', v_price_per_share,
    'new_yes_price', v_new_yes_price,
    'new_no_price', v_new_no_price,
    'transaction_id', v_transaction_id,
    'contract_id', v_contract_id,
    'new_balance', v_wallet.balance_available - v_trade_cost
  );
END;
$function$;

-- Parte 5: Atualizar atomic_execute_sell para verificar speed_trader
CREATE OR REPLACE FUNCTION public.atomic_execute_sell(p_user_id uuid, p_contract_id uuid, p_shares numeric, p_min_value numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet RECORD;
  v_market RECORD;
  v_contract RECORD;
  v_b numeric;
  v_old_cost numeric;
  v_new_cost numeric;
  v_sell_value numeric;
  v_new_yes_shares numeric;
  v_new_no_shares numeric;
  v_new_yes_price numeric;
  v_new_no_price numeric;
  v_transaction_id uuid;
  v_ledger_id uuid;
  v_price_per_share numeric;
  v_cost_basis numeric;
  v_profit numeric;
  v_is_winning boolean;
  v_current_streak integer;
  v_buy_time timestamp with time zone;
  v_is_speed_trade boolean;
BEGIN
  SELECT * INTO v_contract
  FROM user_contracts
  WHERE id = p_contract_id AND user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.shares < p_shares THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient shares');
  END IF;
  
  SELECT * INTO v_wallet 
  FROM wallets 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  SELECT * INTO v_market 
  FROM markets 
  WHERE id = v_contract.market_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market not found');
  END IF;
  
  IF v_market.status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Market is not open for trading');
  END IF;
  
  -- Verificar se é speed trade (compra e venda em menos de 1h)
  SELECT created_at INTO v_buy_time
  FROM transactions
  WHERE user_id = p_user_id 
    AND market_id = v_contract.market_id 
    AND type = 'BUY' 
    AND position = v_contract.position
  ORDER BY created_at DESC
  LIMIT 1;
  
  v_is_speed_trade := v_buy_time IS NOT NULL AND (now() - v_buy_time) < interval '1 hour';
  
  v_b := v_market.lmsr_b;
  v_old_cost := v_b * ln(exp(v_market.yes_shares / v_b) + exp(v_market.no_shares / v_b));
  
  IF v_contract.position = 'YES' THEN
    v_new_yes_shares := v_market.yes_shares - p_shares;
    v_new_no_shares := v_market.no_shares;
  ELSE
    v_new_yes_shares := v_market.yes_shares;
    v_new_no_shares := v_market.no_shares - p_shares;
  END IF;
  
  v_new_cost := v_b * ln(exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_sell_value := v_old_cost - v_new_cost;
  
  IF v_sell_value < p_min_value THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price below minimum value (slippage protection)');
  END IF;
  
  v_new_yes_price := exp(v_new_yes_shares / v_b) / (exp(v_new_yes_shares / v_b) + exp(v_new_no_shares / v_b));
  v_new_no_price := 1 - v_new_yes_price;
  v_price_per_share := v_sell_value / p_shares;
  
  -- Calcular lucro/prejuízo da venda
  v_cost_basis := v_contract.average_price * p_shares;
  v_profit := v_sell_value - v_cost_basis;
  v_is_winning := v_profit > 0;
  
  UPDATE markets SET
    yes_shares = v_new_yes_shares,
    no_shares = v_new_no_shares,
    current_yes_price = v_new_yes_price,
    current_no_price = v_new_no_price,
    updated_at = now()
  WHERE id = v_contract.market_id;
  
  UPDATE wallets SET
    balance_available = balance_available + v_sell_value,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, ref_type, ref_id, status
  ) VALUES (
    p_user_id, v_wallet.id, v_sell_value, v_sell_value, 'CREDIT', 'TRADE', v_contract.market_id, 'COMPLETED'
  ) RETURNING id INTO v_ledger_id;
  
  INSERT INTO transactions (
    user_id, market_id, type, position, shares, price_per_share, total_amount
  ) VALUES (
    p_user_id, v_contract.market_id, 'SELL', v_contract.position, p_shares, v_price_per_share, v_sell_value
  ) RETURNING id INTO v_transaction_id;
  
  IF v_contract.shares = p_shares THEN
    DELETE FROM user_contracts WHERE id = p_contract_id;
  ELSE
    UPDATE user_contracts SET
      shares = shares - p_shares,
      total_invested = total_invested - (v_contract.average_price * p_shares),
      updated_at = now()
    WHERE id = p_contract_id;
  END IF;
  
  -- Obter streak atual do usuário
  SELECT COALESCE(current_streak, 0) INTO v_current_streak FROM profiles WHERE id = p_user_id;
  
  -- Atualizar estatísticas do usuário incluindo speed_trader
  UPDATE profiles SET
    total_trades = COALESCE(total_trades, 0) + 1,
    total_volume = COALESCE(total_volume, 0) + v_sell_value,
    total_profit = COALESCE(total_profit, 0) + v_profit,
    winning_trades = COALESCE(winning_trades, 0) + CASE WHEN v_is_winning THEN 1 ELSE 0 END,
    current_streak = CASE WHEN v_is_winning THEN COALESCE(current_streak, 0) + 1 ELSE 0 END,
    best_streak = GREATEST(COALESCE(best_streak, 0), CASE WHEN v_is_winning THEN v_current_streak + 1 ELSE v_current_streak END),
    best_trade_profit = GREATEST(COALESCE(best_trade_profit, 0), v_profit),
    has_speed_trade = has_speed_trade OR v_is_speed_trade,
    roi_percent = CASE 
      WHEN COALESCE(total_volume, 0) + v_sell_value > 0 
      THEN ((COALESCE(total_profit, 0) + v_profit) / (COALESCE(total_volume, 0) + v_sell_value)) * 100 
      ELSE 0 
    END,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Verificar e conceder conquistas
  PERFORM check_and_grant_achievements(p_user_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'sell_value', v_sell_value,
    'shares', p_shares,
    'price_per_share', v_price_per_share,
    'new_yes_price', v_new_yes_price,
    'new_no_price', v_new_no_price,
    'transaction_id', v_transaction_id,
    'new_balance', v_wallet.balance_available + v_sell_value,
    'profit', v_profit
  );
END;
$function$;

-- Parte 6: Criar função para processar conquistas de liquidação de mercado
CREATE OR REPLACE FUNCTION public.process_market_settlement_achievements(p_market_id uuid, p_winning_outcome text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
BEGIN
  -- Para cada usuário que tinha contrato neste mercado
  FOR v_user IN 
    SELECT DISTINCT uc.user_id, uc.position
    FROM user_contracts uc
    WHERE uc.market_id = p_market_id
  LOOP
    IF v_user.position = p_winning_outcome THEN
      -- Usuário ganhou - incrementar streak
      UPDATE profiles SET
        markets_won_streak = COALESCE(markets_won_streak, 0) + 1,
        best_markets_won_streak = GREATEST(
          COALESCE(best_markets_won_streak, 0), 
          COALESCE(markets_won_streak, 0) + 1
        ),
        updated_at = now()
      WHERE id = v_user.user_id;
    ELSE
      -- Usuário perdeu - resetar streak
      UPDATE profiles SET
        markets_won_streak = 0,
        updated_at = now()
      WHERE id = v_user.user_id;
    END IF;
    
    -- Verificar conquistas
    PERFORM check_and_grant_achievements(v_user.user_id);
  END LOOP;
END;
$function$;

-- Parte 7: Trigger para atualizar cache de referrals quando indicação é ativada
CREATE OR REPLACE FUNCTION public.update_referral_stats_cache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar cache do referrer
  UPDATE profiles SET
    total_referrals = (
      SELECT COUNT(*) FROM referrals WHERE referrer_id = NEW.referrer_id
    ),
    activated_referrals = (
      SELECT COUNT(*) FROM referrals 
      WHERE referrer_id = NEW.referrer_id AND status = 'ACTIVATED'
    ),
    updated_at = now()
  WHERE id = NEW.referrer_id;
  
  -- Verificar conquistas do referrer
  PERFORM check_and_grant_achievements(NEW.referrer_id);
  
  RETURN NEW;
END;
$function$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_update_referral_cache ON referrals;
CREATE TRIGGER trigger_update_referral_cache
  AFTER INSERT OR UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_stats_cache();

-- Parte 8: Trigger para atualizar cache de comissões
CREATE OR REPLACE FUNCTION public.update_commission_cache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_id uuid;
BEGIN
  -- Obter o referrer_id da referral
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE id = NEW.referral_id;
  
  IF v_referrer_id IS NOT NULL THEN
    -- Atualizar total de comissões
    UPDATE profiles SET
      total_referral_commission = (
        SELECT COALESCE(SUM(commission_amount), 0) 
        FROM referral_commissions rc
        JOIN referrals r ON r.id = rc.referral_id
        WHERE r.referrer_id = v_referrer_id
      ),
      updated_at = now()
    WHERE id = v_referrer_id;
    
    -- Verificar conquistas
    PERFORM check_and_grant_achievements(v_referrer_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_update_commission_cache ON referral_commissions;
CREATE TRIGGER trigger_update_commission_cache
  AFTER INSERT ON referral_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_cache();

-- Parte 9: Atualizar check_and_grant_achievements para incluir novas conquistas
CREATE OR REPLACE FUNCTION public.check_and_grant_achievements(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_achievement RECORD;
  v_user_rank integer;
BEGIN
  -- Get user profile stats
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN;
  END IF;

  -- Check trade count achievements
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code IN ('first_trade', 'trades_10', 'trades_50', 'trades_100', 'trades_500')
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF (v_achievement.code = 'first_trade' AND v_profile.total_trades >= 1)
       OR (v_achievement.code = 'trades_10' AND v_profile.total_trades >= 10)
       OR (v_achievement.code = 'trades_50' AND v_profile.total_trades >= 50)
       OR (v_achievement.code = 'trades_100' AND v_profile.total_trades >= 100)
       OR (v_achievement.code = 'trades_500' AND v_profile.total_trades >= 500)
    THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check streak achievements
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code IN ('streak_3', 'streak_5', 'streak_10')
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF (v_achievement.code = 'streak_3' AND v_profile.best_streak >= 3)
       OR (v_achievement.code = 'streak_5' AND v_profile.best_streak >= 5)
       OR (v_achievement.code = 'streak_10' AND v_profile.best_streak >= 10)
    THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check profit achievements
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code IN ('profit_100', 'profit_1000', 'profit_10000')
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF (v_achievement.code = 'profit_100' AND v_profile.total_profit >= 100)
       OR (v_achievement.code = 'profit_1000' AND v_profile.total_profit >= 1000)
       OR (v_achievement.code = 'profit_10000' AND v_profile.total_profit >= 10000)
    THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check volume achievements
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code IN ('volume_1000', 'volume_10000', 'volume_100000')
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF (v_achievement.code = 'volume_1000' AND v_profile.total_volume >= 1000)
       OR (v_achievement.code = 'volume_10000' AND v_profile.total_volume >= 10000)
       OR (v_achievement.code = 'volume_100000' AND v_profile.total_volume >= 100000)
    THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check Early Adopter achievement (first 1000 users)
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code = 'early_adopter'
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    SELECT COUNT(*) + 1 INTO v_user_rank
    FROM profiles p2
    WHERE p2.created_at < v_profile.created_at;
    
    IF v_user_rank <= 1000 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check Prophet achievements (markets won streak)
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code IN ('prophet_3', 'prophet_5', 'prophet_10')
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF (v_achievement.code = 'prophet_3' AND COALESCE(v_profile.best_markets_won_streak, 0) >= 3)
       OR (v_achievement.code = 'prophet_5' AND COALESCE(v_profile.best_markets_won_streak, 0) >= 5)
       OR (v_achievement.code = 'prophet_10' AND COALESCE(v_profile.best_markets_won_streak, 0) >= 10)
    THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check special time-based achievements
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code IN ('night_owl', 'early_bird', 'speed_trader', 'contrarian')
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF (v_achievement.code = 'night_owl' AND COALESCE(v_profile.has_night_trade, false) = true)
       OR (v_achievement.code = 'early_bird' AND COALESCE(v_profile.has_early_trade, false) = true)
       OR (v_achievement.code = 'speed_trader' AND COALESCE(v_profile.has_speed_trade, false) = true)
       OR (v_achievement.code = 'contrarian' AND COALESCE(v_profile.has_contrarian_trade, false) = true)
    THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check weekend warrior achievement
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code = 'weekend_warrior'
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF COALESCE(v_profile.weekend_trades, 0) >= 10 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check referral count achievements
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code IN ('referral_first', 'referral_5', 'referral_10', 'referral_25')
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF (v_achievement.code = 'referral_first' AND COALESCE(v_profile.total_referrals, 0) >= 1)
       OR (v_achievement.code = 'referral_5' AND COALESCE(v_profile.total_referrals, 0) >= 5)
       OR (v_achievement.code = 'referral_10' AND COALESCE(v_profile.total_referrals, 0) >= 10)
       OR (v_achievement.code = 'referral_25' AND COALESCE(v_profile.total_referrals, 0) >= 25)
    THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check referral activated achievement
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code = 'referral_activated_5'
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF COALESCE(v_profile.activated_referrals, 0) >= 5 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check referral commission achievements
  FOR v_achievement IN 
    SELECT a.id, a.code FROM achievements a
    WHERE a.is_active = true
    AND a.code IN ('referral_earnings_100', 'referral_earnings_500', 'referral_earnings_1000')
    AND NOT EXISTS (
      SELECT 1 FROM user_achievements ua 
      WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
    )
  LOOP
    IF (v_achievement.code = 'referral_earnings_100' AND COALESCE(v_profile.total_referral_commission, 0) >= 100)
       OR (v_achievement.code = 'referral_earnings_500' AND COALESCE(v_profile.total_referral_commission, 0) >= 500)
       OR (v_achievement.code = 'referral_earnings_1000' AND COALESCE(v_profile.total_referral_commission, 0) >= 1000)
    THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;