-- Insert trading milestone achievements (if they don't exist)
INSERT INTO achievements (code, name, description, icon, category, points, is_active)
VALUES
  ('first_trade', 'Primeira Negociação', 'Completou sua primeira negociação', '🎯', 'trading', 10, true),
  ('trades_10', 'Trader Iniciante', 'Completou 10 negociações', '📈', 'trading', 25, true),
  ('trades_50', 'Trader Experiente', 'Completou 50 negociações', '📊', 'trading', 50, true),
  ('trades_100', 'Trader Veterano', 'Completou 100 negociações', '🏆', 'trading', 100, true),
  ('trades_500', 'Trader Elite', 'Completou 500 negociações', '👑', 'trading', 250, true),
  ('streak_3', 'Sequência de 3', 'Obteve 3 vitórias consecutivas', '🔥', 'streak', 20, true),
  ('streak_5', 'Sequência de 5', 'Obteve 5 vitórias consecutivas', '🔥🔥', 'streak', 40, true),
  ('streak_10', 'Sequência de 10', 'Obteve 10 vitórias consecutivas', '🔥🔥🔥', 'streak', 100, true),
  ('profit_100', 'Lucro de R$100', 'Acumulou R$100 em lucros', '💰', 'profit', 30, true),
  ('profit_1000', 'Lucro de R$1.000', 'Acumulou R$1.000 em lucros', '💎', 'profit', 75, true),
  ('profit_10000', 'Lucro de R$10.000', 'Acumulou R$10.000 em lucros', '🚀', 'profit', 200, true),
  ('volume_1000', 'Volume R$1.000', 'Negociou R$1.000 em volume total', '📊', 'volume', 25, true),
  ('volume_10000', 'Volume R$10.000', 'Negociou R$10.000 em volume total', '📈', 'volume', 75, true),
  ('volume_100000', 'Volume R$100.000', 'Negociou R$100.000 em volume total', '🏦', 'volume', 200, true)
ON CONFLICT (code) DO NOTHING;

-- Create function to check and grant achievements
CREATE OR REPLACE FUNCTION public.check_and_grant_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_achievement RECORD;
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
END;
$$;

-- Create trigger function to check achievements after transaction
CREATE OR REPLACE FUNCTION public.trigger_check_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check achievements for the user who made the transaction
  PERFORM check_and_grant_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS check_achievements_after_transaction ON transactions;
CREATE TRIGGER check_achievements_after_transaction
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_achievements();

-- Add unique constraint to prevent duplicate achievements
ALTER TABLE user_achievements 
  DROP CONSTRAINT IF EXISTS user_achievements_user_achievement_unique;
ALTER TABLE user_achievements 
  ADD CONSTRAINT user_achievements_user_achievement_unique 
  UNIQUE (user_id, achievement_id);