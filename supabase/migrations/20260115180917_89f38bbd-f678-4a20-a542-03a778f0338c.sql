-- Create comments table with support for nested replies
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_comments_market_id ON public.comments(market_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);

-- Create comment_likes table
CREATE TABLE public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_id ON public.comment_likes(user_id);

-- Create comment_reports table for moderation
CREATE TABLE public.comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'offensive', 'misinformation', 'other')),
  description TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT CHECK (action_taken IN ('none', 'hidden', 'deleted', 'user_warned')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comment_reports_status ON public.comment_reports(status);
CREATE INDEX idx_comment_reports_comment_id ON public.comment_reports(comment_id);

-- Add new notification types to enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'COMMENT_MENTION';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'COMMENT_LIKE';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'COMMENT_REPLY';

-- Add social notification preferences
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS in_app_social BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_mentions BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Comments are publicly readable" ON public.comments
  FOR SELECT USING (is_hidden = false OR user_id = auth.uid());

CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all comments" ON public.comments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for comment_likes
CREATE POLICY "Likes are publicly readable" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can create own likes" ON public.comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comment_reports
CREATE POLICY "Users can create reports" ON public.comment_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON public.comment_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage all reports" ON public.comment_reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Function to increment likes count
CREATE OR REPLACE FUNCTION public.increment_comment_likes(p_comment_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.comments 
  SET likes_count = likes_count + 1, updated_at = now()
  WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to decrement likes count
CREATE OR REPLACE FUNCTION public.decrement_comment_likes(p_comment_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.comments 
  SET likes_count = GREATEST(likes_count - 1, 0), updated_at = now()
  WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to increment replies count
CREATE OR REPLACE FUNCTION public.increment_replies_count(p_comment_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.comments 
  SET replies_count = replies_count + 1, updated_at = now()
  WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to decrement replies count
CREATE OR REPLACE FUNCTION public.decrement_replies_count(p_comment_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.comments 
  SET replies_count = GREATEST(replies_count - 1, 0), updated_at = now()
  WHERE id = p_comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update updated_at
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();