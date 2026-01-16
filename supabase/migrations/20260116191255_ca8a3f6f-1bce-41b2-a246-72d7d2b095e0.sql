-- Create function to notify user when achievement is unlocked
CREATE OR REPLACE FUNCTION public.notify_achievement_unlocked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_achievement RECORD;
  v_notification_prefs RECORD;
BEGIN
  -- Get achievement details
  SELECT * INTO v_achievement 
  FROM achievements 
  WHERE id = NEW.achievement_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Check user notification preferences
  SELECT * INTO v_notification_prefs
  FROM notification_preferences
  WHERE user_id = NEW.user_id;
  
  -- If no preferences exist or achievements notifications are enabled (default true)
  IF v_notification_prefs IS NULL OR v_notification_prefs.in_app_achievements = true THEN
    -- Insert notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      NEW.user_id,
      'ACHIEVEMENT_UNLOCKED',
      'Conquista Desbloqueada! 🏆',
      v_achievement.name || ' - ' || v_achievement.description,
      jsonb_build_object(
        'achievement_id', NEW.achievement_id,
        'achievement_code', v_achievement.code,
        'achievement_name', v_achievement.name,
        'achievement_icon', v_achievement.icon,
        'achievement_points', v_achievement.points,
        'achievement_category', v_achievement.category
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_achievements table
DROP TRIGGER IF EXISTS trigger_notify_achievement_unlocked ON user_achievements;

CREATE TRIGGER trigger_notify_achievement_unlocked
  AFTER INSERT ON user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION notify_achievement_unlocked();