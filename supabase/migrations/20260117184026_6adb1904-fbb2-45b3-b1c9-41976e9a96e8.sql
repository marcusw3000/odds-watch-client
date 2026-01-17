-- Create table for suggestion comment reports
CREATE TABLE public.suggestion_comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.suggestion_comments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'offensive', 'misinformation', 'other')),
  description TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT CHECK (action_taken IN ('none', 'hidden', 'deleted', 'user_warned')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suggestion_comment_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create suggestion comment reports" ON public.suggestion_comment_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own suggestion comment reports" ON public.suggestion_comment_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage all suggestion comment reports" ON public.suggestion_comment_reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_suggestion_comment_reports_comment_id ON public.suggestion_comment_reports(comment_id);
CREATE INDEX idx_suggestion_comment_reports_status ON public.suggestion_comment_reports(status);