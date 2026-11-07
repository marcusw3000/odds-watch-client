-- Moderation of site comments is independent of legacy market comments and chat.
ALTER TABLE public.polymarket_event_comments ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
DROP POLICY "Public read Polymarket event comments" ON public.polymarket_event_comments;
CREATE POLICY "Public read visible Polymarket comments" ON public.polymarket_event_comments
  FOR SELECT TO anon, authenticated USING (NOT is_hidden OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.polymarket_comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.polymarket_event_comments(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','offensive','misinformation','other')),
  description text CHECK (length(description) <= 1000),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','DISMISSED','ACTIONED')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  action_taken text CHECK (action_taken IN ('none','hidden','deleted','user_warned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, reporter_id)
);
ALTER TABLE public.polymarket_comment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporters submit own Polymarket reports" ON public.polymarket_comment_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id=auth.uid() AND EXISTS (SELECT 1 FROM public.polymarket_event_comments c WHERE c.id=comment_id AND c.user_id<>auth.uid() AND NOT c.is_hidden));
CREATE POLICY "Admins read Polymarket reports" ON public.polymarket_comment_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.polymarket_comment_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.polymarket_comment_reports TO authenticated;
GRANT INSERT (comment_id, reason, description) ON public.polymarket_comment_reports TO authenticated;
NOTIFY pgrst, 'reload schema';
