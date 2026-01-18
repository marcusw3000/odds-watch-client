-- Recriar função notify_admins com cast correto para ENUM
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type text, 
  p_title text, 
  p_message text, 
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_id uuid;
BEGIN
  -- Loop through all admins and moderators
  FOR admin_id IN 
    SELECT user_id FROM user_roles WHERE role IN ('admin', 'moderator')
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (admin_id, p_type::notification_type, p_title, p_message, p_data);
  END LOOP;
END;
$$;