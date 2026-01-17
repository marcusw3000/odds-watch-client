-- Corrigir função check_and_grant_achievements para usar ACHIEVEMENT_UNLOCKED ao invés de ACHIEVEMENT
CREATE OR REPLACE FUNCTION public.check_and_grant_achievements(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile profiles%ROWTYPE;
  v_achievement achievements%ROWTYPE;
  v_should_grant boolean;
  v_suggestions_created integer;
  v_suggestions_approved integer;
  v_suggestions_implemented integer;
  v_best_suggestion_score integer;
BEGIN
  -- Buscar perfil do usuário
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN;
  END IF;

  -- Calcular estatísticas de sugestões
  SELECT COUNT(*) INTO v_suggestions_created
  FROM market_suggestions WHERE user_id = p_user_id;
  
  SELECT COUNT(*) INTO v_suggestions_approved
  FROM market_suggestions WHERE user_id = p_user_id AND status IN ('APPROVED', 'IMPLEMENTED');
  
  SELECT COUNT(*) INTO v_suggestions_implemented
  FROM market_suggestions WHERE user_id = p_user_id AND status = 'IMPLEMENTED';
  
  SELECT COALESCE(MAX(score), 0) INTO v_best_suggestion_score
  FROM market_suggestions WHERE user_id = p_user_id;
  
  -- Atualizar cache no profile
  UPDATE profiles SET
    suggestions_created = v_suggestions_created,
    suggestions_approved = v_suggestions_approved,
    suggestions_implemented = v_suggestions_implemented,
    best_suggestion_score = v_best_suggestion_score
  WHERE id = p_user_id;

  -- Iterar sobre todas as conquistas ativas
  FOR v_achievement IN SELECT * FROM achievements WHERE is_active = true LOOP
    v_should_grant := false;
    
    -- Verificar se já possui a conquista
    IF EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = v_achievement.id) THEN
      CONTINUE;
    END IF;
    
    -- Verificar cada conquista
    CASE v_achievement.code
      -- Trading achievements
      WHEN 'first_trade' THEN
        v_should_grant := v_profile.total_trades >= 1;
      WHEN 'trades_10' THEN
        v_should_grant := v_profile.total_trades >= 10;
      WHEN 'trades_50' THEN
        v_should_grant := v_profile.total_trades >= 50;
      WHEN 'trades_100' THEN
        v_should_grant := v_profile.total_trades >= 100;
      WHEN 'trades_500' THEN
        v_should_grant := v_profile.total_trades >= 500;
      
      -- Profit achievements
      WHEN 'profit_100' THEN
        v_should_grant := v_profile.total_profit >= 100;
      WHEN 'profit_500' THEN
        v_should_grant := v_profile.total_profit >= 500;
      WHEN 'profit_1000' THEN
        v_should_grant := v_profile.total_profit >= 1000;
      WHEN 'profit_5000' THEN
        v_should_grant := v_profile.total_profit >= 5000;
      WHEN 'profit_10000' THEN
        v_should_grant := v_profile.total_profit >= 10000;
      
      -- Volume achievements
      WHEN 'volume_1000' THEN
        v_should_grant := v_profile.total_volume >= 1000;
      WHEN 'volume_5000' THEN
        v_should_grant := v_profile.total_volume >= 5000;
      WHEN 'volume_10000' THEN
        v_should_grant := v_profile.total_volume >= 10000;
      WHEN 'volume_50000' THEN
        v_should_grant := v_profile.total_volume >= 50000;
      WHEN 'volume_100000' THEN
        v_should_grant := v_profile.total_volume >= 100000;
      
      -- Streak achievements
      WHEN 'streak_3' THEN
        v_should_grant := v_profile.best_streak >= 3;
      WHEN 'streak_5' THEN
        v_should_grant := v_profile.best_streak >= 5;
      WHEN 'streak_10' THEN
        v_should_grant := v_profile.best_streak >= 10;
      WHEN 'streak_20' THEN
        v_should_grant := v_profile.best_streak >= 20;
      
      -- ROI achievements
      WHEN 'roi_10' THEN
        v_should_grant := v_profile.roi_percent >= 10;
      WHEN 'roi_25' THEN
        v_should_grant := v_profile.roi_percent >= 25;
      WHEN 'roi_50' THEN
        v_should_grant := v_profile.roi_percent >= 50;
      WHEN 'roi_100' THEN
        v_should_grant := v_profile.roi_percent >= 100;
      
      -- Winning rate achievements
      WHEN 'win_rate_60' THEN
        v_should_grant := v_profile.total_trades >= 10 AND (v_profile.winning_trades::numeric / v_profile.total_trades) >= 0.60;
      WHEN 'win_rate_70' THEN
        v_should_grant := v_profile.total_trades >= 20 AND (v_profile.winning_trades::numeric / v_profile.total_trades) >= 0.70;
      WHEN 'win_rate_80' THEN
        v_should_grant := v_profile.total_trades >= 30 AND (v_profile.winning_trades::numeric / v_profile.total_trades) >= 0.80;
      
      -- Special achievements
      WHEN 'prophet_3' THEN
        v_should_grant := v_profile.best_markets_won_streak >= 3;
      WHEN 'prophet_5' THEN
        v_should_grant := v_profile.best_markets_won_streak >= 5;
      WHEN 'prophet_10' THEN
        v_should_grant := v_profile.best_markets_won_streak >= 10;
      WHEN 'night_owl' THEN
        v_should_grant := v_profile.has_night_trade = true;
      WHEN 'early_bird' THEN
        v_should_grant := v_profile.has_early_trade = true;
      WHEN 'weekend_warrior' THEN
        v_should_grant := v_profile.weekend_trades >= 10;
      WHEN 'speed_trader' THEN
        v_should_grant := v_profile.has_speed_trade = true;
      WHEN 'contrarian' THEN
        v_should_grant := v_profile.has_contrarian_trade = true;
      
      -- Referral achievements
      WHEN 'referral_first' THEN
        v_should_grant := v_profile.total_referrals >= 1;
      WHEN 'referral_5' THEN
        v_should_grant := v_profile.total_referrals >= 5;
      WHEN 'referral_10' THEN
        v_should_grant := v_profile.total_referrals >= 10;
      WHEN 'referral_25' THEN
        v_should_grant := v_profile.total_referrals >= 25;
      WHEN 'referral_activated_5' THEN
        v_should_grant := v_profile.activated_referrals >= 5;
      WHEN 'referral_earnings_100' THEN
        v_should_grant := v_profile.total_referral_commission >= 100;
      WHEN 'referral_earnings_500' THEN
        v_should_grant := v_profile.total_referral_commission >= 500;
      WHEN 'referral_earnings_1000' THEN
        v_should_grant := v_profile.total_referral_commission >= 1000;
      
      -- Suggestion achievements
      WHEN 'suggestion_first' THEN
        v_should_grant := v_suggestions_created >= 1;
      WHEN 'suggestion_5' THEN
        v_should_grant := v_suggestions_created >= 5;
      WHEN 'suggestion_approved' THEN
        v_should_grant := v_suggestions_approved >= 1;
      WHEN 'suggestion_implemented' THEN
        v_should_grant := v_suggestions_implemented >= 1;
      WHEN 'suggestion_popular' THEN
        v_should_grant := v_best_suggestion_score >= 50;
      
      ELSE
        v_should_grant := false;
    END CASE;
    
    -- Conceder conquista se aplicável
    IF v_should_grant THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
      
      -- Criar notificação com tipo CORRETO: ACHIEVEMENT_UNLOCKED
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
$function$;