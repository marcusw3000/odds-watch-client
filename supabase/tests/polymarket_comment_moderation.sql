-- Execute against a disposable PostgreSQL database with the comment migrations installed.
BEGIN;
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
INSERT INTO public.profiles(id, display_name) VALUES ('00000000-0000-4000-8000-000000000001','Author'), ('00000000-0000-4000-8000-000000000002','Reporter');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
INSERT INTO public.polymarket_event_comments(id,event_id,content) VALUES ('00000000-0000-4000-8000-000000000003','123','Example');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.polymarket_comment_reports(comment_id,reason) VALUES ('00000000-0000-4000-8000-000000000003','other');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.polymarket_comment_reports) THEN RAISE EXCEPTION 'report visible to non-admin'; END IF;
  BEGIN
    INSERT INTO public.polymarket_comment_reports(comment_id,reason) VALUES ('00000000-0000-4000-8000-000000000003','spam');
    RAISE EXCEPTION 'duplicate report accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.polymarket_event_comments SET is_hidden=true WHERE id='00000000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.polymarket_event_comments WHERE id='00000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'hidden comment visible'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
