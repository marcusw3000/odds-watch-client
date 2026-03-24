
-- Create messages table for global chat
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_content_length CHECK (char_length(content) <= 300)
);

-- Index for fast queries on recent messages
CREATE INDEX idx_messages_created_at ON public.messages (created_at DESC);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all messages
CREATE POLICY "Authenticated users can read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own messages
CREATE POLICY "Users can insert own messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Schedule cleanup every 3 hours: delete messages older than 6 hours
SELECT cron.schedule(
  'cleanup-chat-messages',
  '0 */3 * * *',
  $$DELETE FROM public.messages WHERE created_at < now() - interval '6 hours'$$
);
