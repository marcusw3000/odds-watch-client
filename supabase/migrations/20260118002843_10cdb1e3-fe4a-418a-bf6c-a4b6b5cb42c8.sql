-- Create admin notification types (if not already in enum, we use type assertion in code)
-- Note: ADMIN_NEW_TICKET, ADMIN_NEW_REPORT, ADMIN_NEW_CONTESTATION will be added to NotificationType in code

-- Function to notify all admins/moderators
CREATE OR REPLACE FUNCTION notify_admins(
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
BEGIN
  -- Loop through all admins and moderators
  FOR admin_id IN 
    SELECT user_id FROM user_roles WHERE role IN ('admin', 'moderator')
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (admin_id, p_type, p_title, p_message, p_data);
  END LOOP;
END;
$$;

-- Trigger function for new support tickets
CREATE OR REPLACE FUNCTION trigger_notify_admin_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
BEGIN
  -- Get user display name
  SELECT COALESCE(display_name, email, 'Usuário') INTO user_name
  FROM profiles WHERE id = NEW.user_id;
  
  IF user_name IS NULL THEN
    user_name := 'Usuário';
  END IF;

  PERFORM notify_admins(
    'ADMIN_NEW_TICKET',
    'Novo Ticket de Suporte',
    format('%s abriu ticket: %s', user_name, NEW.subject),
    jsonb_build_object(
      'ticket_id', NEW.id,
      'subject', NEW.subject,
      'category', NEW.category,
      'user_id', NEW.user_id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function for new comment reports
CREATE OR REPLACE FUNCTION trigger_notify_admin_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reason_text text;
BEGIN
  reason_text := CASE NEW.reason
    WHEN 'spam' THEN 'Spam'
    WHEN 'offensive' THEN 'Conteúdo Ofensivo'
    WHEN 'misinformation' THEN 'Desinformação'
    ELSE 'Outro'
  END;

  PERFORM notify_admins(
    'ADMIN_NEW_REPORT',
    'Nova Denúncia de Comentário',
    format('Comentário denunciado por: %s', reason_text),
    jsonb_build_object(
      'report_id', NEW.id,
      'comment_id', NEW.comment_id,
      'reason', NEW.reason,
      'reporter_id', NEW.reporter_id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function for new suggestion comment reports
CREATE OR REPLACE FUNCTION trigger_notify_admin_new_suggestion_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reason_text text;
BEGIN
  reason_text := CASE NEW.reason
    WHEN 'spam' THEN 'Spam'
    WHEN 'offensive' THEN 'Conteúdo Ofensivo'
    WHEN 'misinformation' THEN 'Desinformação'
    ELSE 'Outro'
  END;

  PERFORM notify_admins(
    'ADMIN_NEW_REPORT',
    'Nova Denúncia em Sugestão',
    format('Comentário de sugestão denunciado por: %s', reason_text),
    jsonb_build_object(
      'report_id', NEW.id,
      'comment_id', NEW.comment_id,
      'reason', NEW.reason,
      'reporter_id', NEW.reporter_id,
      'is_suggestion_report', true
    )
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function for new contestations
CREATE OR REPLACE FUNCTION trigger_notify_admin_new_contestation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  market_title text;
BEGIN
  -- Get market title
  SELECT title INTO market_title
  FROM markets WHERE id = NEW.market_id;
  
  IF market_title IS NULL THEN
    market_title := 'Mercado';
  END IF;

  PERFORM notify_admins(
    'ADMIN_NEW_CONTESTATION',
    'Nova Contestação de Resultado',
    format('Contestação em: %s', market_title),
    jsonb_build_object(
      'contestation_id', NEW.id,
      'market_id', NEW.market_id,
      'user_id', NEW.user_id,
      'reason', NEW.reason
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS on_support_ticket_created ON support_tickets;
CREATE TRIGGER on_support_ticket_created
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_admin_new_ticket();

DROP TRIGGER IF EXISTS on_comment_report_created ON comment_reports;
CREATE TRIGGER on_comment_report_created
  AFTER INSERT ON comment_reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_admin_new_report();

DROP TRIGGER IF EXISTS on_suggestion_comment_report_created ON suggestion_comment_reports;
CREATE TRIGGER on_suggestion_comment_report_created
  AFTER INSERT ON suggestion_comment_reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_admin_new_suggestion_report();

DROP TRIGGER IF EXISTS on_contestation_created ON contestations;
CREATE TRIGGER on_contestation_created
  AFTER INSERT ON contestations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_admin_new_contestation();