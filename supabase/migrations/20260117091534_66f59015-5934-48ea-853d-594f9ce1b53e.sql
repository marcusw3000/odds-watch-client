-- Atualizar check_and_grant_achievements para incluir Early Adopter
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
    -- Get user's registration rank
    SELECT COUNT(*) + 1 INTO v_user_rank
    FROM profiles p2
    WHERE p2.created_at < v_profile.created_at;
    
    -- Grant if user is within first 1000
    IF v_user_rank <= 1000 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;

-- Conceder Early Adopter aos usuários existentes (primeiros 1000)
DO $$
DECLARE
  v_user RECORD;
  v_achievement_id uuid;
  v_rank integer := 0;
BEGIN
  -- Get early_adopter achievement id
  SELECT id INTO v_achievement_id FROM achievements WHERE code = 'early_adopter' AND is_active = true;
  
  IF v_achievement_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Grant to first 1000 users ordered by registration date
  FOR v_user IN 
    SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1000
  LOOP
    v_rank := v_rank + 1;
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (v_user.id, v_achievement_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;