-- Add moderation columns to chat_reports
ALTER TABLE public.chat_reports
  ADD COLUMN status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN action_taken text,
  ADD COLUMN description text;

-- Allow admins to update chat reports
CREATE POLICY "Admins can update chat reports"
  ON public.chat_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete chat reports  
CREATE POLICY "Admins can delete chat reports"
  ON public.chat_reports FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));