-- Corrigir função check_and_grant_achievements que usava tipo de notificação inválido
CREATE OR REPLACE FUNCTION public.check_and_grant_achievements(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_achievement achievements%ROWTYPE;
  v_already_earned BOOLEAN;
BEGIN
  -- Buscar perfil atualizado
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Verificar conquistas relacionadas a sugestões
  FOR v_achievement IN 
    SELECT * FROM achievements 
    WHERE is_active = true 
    AND category = 'suggestions'
  LOOP
    -- Verificar se já tem a conquista
    SELECT EXISTS(
      SELECT 1 FROM user_achievements 
      WHERE user_id = p_user_id AND achievement_id = v_achievement.id
    ) INTO v_already_earned;
    
    IF v_already_earned THEN
      CONTINUE;
    END IF;
    
    -- Verificar critérios por código
    IF v_achievement.code = 'FIRST_SUGGESTION' AND v_profile.suggestions_created >= 1 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
      
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        p_user_id,
        'ACHIEVEMENT_UNLOCKED',
        'Nova Conquista!',
        'Você desbloqueou: ' || v_achievement.name,
        jsonb_build_object(
          'achievement_id', v_achievement.id,
          'achievement_code', v_achievement.code,
          'achievement_name', v_achievement.name,
          'points', v_achievement.points
        )
      );
      
    ELSIF v_achievement.code = 'SUGGESTION_APPROVED' AND v_profile.suggestions_approved >= 1 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
      
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        p_user_id,
        'ACHIEVEMENT_UNLOCKED',
        'Nova Conquista!',
        'Você desbloqueou: ' || v_achievement.name,
        jsonb_build_object(
          'achievement_id', v_achievement.id,
          'achievement_code', v_achievement.code,
          'achievement_name', v_achievement.name,
          'points', v_achievement.points
        )
      );
      
    ELSIF v_achievement.code = 'SUGGESTION_IMPLEMENTED' AND v_profile.suggestions_implemented >= 1 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
      
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        p_user_id,
        'ACHIEVEMENT_UNLOCKED',
        'Nova Conquista!',
        'Você desbloqueou: ' || v_achievement.name,
        jsonb_build_object(
          'achievement_id', v_achievement.id,
          'achievement_code', v_achievement.code,
          'achievement_name', v_achievement.name,
          'points', v_achievement.points
        )
      );
      
    ELSIF v_achievement.code = 'TOP_SUGGESTER' AND v_profile.best_suggestion_score >= 100 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
      
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        p_user_id,
        'ACHIEVEMENT_UNLOCKED',
        'Nova Conquista!',
        'Você desbloqueou: ' || v_achievement.name,
        jsonb_build_object(
          'achievement_id', v_achievement.id,
          'achievement_code', v_achievement.code,
          'achievement_name', v_achievement.name,
          'points', v_achievement.points
        )
      );
    END IF;
  END LOOP;
END;
$$;