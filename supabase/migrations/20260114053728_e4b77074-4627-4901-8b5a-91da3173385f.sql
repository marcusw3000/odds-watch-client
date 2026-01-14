-- Create notification types enum
CREATE TYPE public.notification_type AS ENUM (
  'MARKET_CLOSING_SOON',
  'MARKET_HALTED',
  'MARKET_SETTLED',
  'TRADE_EXECUTED',
  'ACHIEVEMENT_UNLOCKED',
  'LEADERBOARD_RANK',
  'REFERRAL_ACTIVATED',
  'SYSTEM_ANNOUNCEMENT'
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- In-app preferences
  in_app_market_updates BOOLEAN NOT NULL DEFAULT true,
  in_app_trade_updates BOOLEAN NOT NULL DEFAULT true,
  in_app_achievements BOOLEAN NOT NULL DEFAULT true,
  in_app_system BOOLEAN NOT NULL DEFAULT true,
  -- Email preferences
  email_market_settled BOOLEAN NOT NULL DEFAULT true,
  email_market_closing BOOLEAN NOT NULL DEFAULT true,
  email_weekly_summary BOOLEAN NOT NULL DEFAULT false,
  email_marketing BOOLEAN NOT NULL DEFAULT false,
  -- Settings
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL OR auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Notification preferences policies
CREATE POLICY "Users can view own preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences"
ON public.notification_preferences FOR ALL
USING (auth.uid() = user_id);

-- Update trigger for preferences
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;