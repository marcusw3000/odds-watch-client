-- Create event templates table
CREATE TABLE public.event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  title_pattern TEXT NOT NULL,
  description TEXT,
  resolution JSONB,
  card_style TEXT DEFAULT 'default',
  recurrence_type TEXT DEFAULT 'none',
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all templates
CREATE POLICY "Admins can read all templates"
ON public.event_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to create templates
CREATE POLICY "Admins can create templates"
ON public.event_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to update templates
CREATE POLICY "Admins can update templates"
ON public.event_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to delete templates
CREATE POLICY "Admins can delete templates"
ON public.event_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.raw_user_meta_data->>'role' = 'admin'
  )
);