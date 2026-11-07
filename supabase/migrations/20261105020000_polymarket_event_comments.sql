CREATE TABLE public.polymarket_event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL CHECK (event_id ~ '^[0-9]{1,20}$'),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Usuário',
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX polymarket_event_comments_event_date_idx ON public.polymarket_event_comments(event_id, created_at DESC);
ALTER TABLE public.polymarket_event_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read Polymarket event comments" ON public.polymarket_event_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users add own Polymarket event comments" ON public.polymarket_event_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own Polymarket event comments" ON public.polymarket_event_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.polymarket_event_comments FROM anon, authenticated;
GRANT SELECT ON public.polymarket_event_comments TO anon, authenticated;
GRANT INSERT (event_id, content) ON public.polymarket_event_comments TO authenticated;
GRANT DELETE ON public.polymarket_event_comments TO authenticated;

CREATE FUNCTION public.prepare_polymarket_event_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 90210));
  SELECT count(*) INTO recent_count FROM public.polymarket_event_comments
    WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute';
  IF recent_count >= 5 THEN RAISE EXCEPTION 'Comment rate limit exceeded'; END IF;
  NEW.user_id := auth.uid();
  NEW.content := btrim(NEW.content);
  SELECT left(COALESCE(NULLIF(btrim(display_name), ''), 'Usuário'), 60)
    INTO NEW.author_name FROM public.profiles WHERE id = auth.uid();
  NEW.author_name := COALESCE(NEW.author_name, 'Usuário');
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_polymarket_event_comment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prepare_polymarket_event_comment BEFORE INSERT ON public.polymarket_event_comments
  FOR EACH ROW EXECUTE FUNCTION public.prepare_polymarket_event_comment();
