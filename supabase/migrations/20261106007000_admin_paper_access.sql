-- RLS remains authoritative for authenticated administrators.
GRANT SELECT ON public.admin_audit_logs, public.support_tickets TO authenticated;
GRANT SELECT ON public.support_messages TO authenticated;
GRANT INSERT (user_id, subject, category) ON public.support_tickets TO authenticated;
GRANT INSERT (ticket_id, sender_id, message, is_staff) ON public.support_messages TO authenticated;
DROP POLICY IF EXISTS "Users can send messages to their tickets" ON public.support_messages;
CREATE POLICY "Users can send messages to their tickets" ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND (NOT is_staff OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) AND EXISTS (
  SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND
    ((t.user_id = auth.uid() AND t.status NOT IN ('closed', 'resolved')) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
));
GRANT SELECT ON public.admin_audit_logs, public.user_roles, public.polymarket_paper_ranking_stats TO service_role;
GRANT INSERT ON public.admin_audit_logs, public.notifications, public.support_messages TO service_role;
GRANT SELECT ON public.support_tickets, public.support_messages, public.polymarket_comment_reports TO service_role;
GRANT UPDATE ON public.support_tickets, public.polymarket_comment_reports, public.polymarket_event_comments TO service_role;
GRANT DELETE ON public.polymarket_event_comments TO service_role;
GRANT UPDATE (is_blocked, blocked_at, blocked_reason, blocked_by, updated_at) ON public.profiles TO service_role;
GRANT INSERT, DELETE ON public.user_roles TO service_role;
CREATE OR REPLACE FUNCTION public.get_admin_user_paper_referrals(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object('total', count(*), 'activated', count(*) FILTER (WHERE coalesce(s.trade_count,0)>0),
    'pending', count(*) FILTER (WHERE coalesce(s.trade_count,0)=0)) INTO result
    FROM public.paper_referral_links l LEFT JOIN public.polymarket_paper_ranking_stats s ON s.user_id=l.referred_id WHERE l.referrer_id=p_user;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_user_paper_referrals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_paper_referrals(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_admin_catalog_health() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'market_count', (SELECT count(*) FROM public.polymarket_market_cache),
    'latest_sync', (SELECT max(synced_at) FROM public.polymarket_market_cache),
    'latest_closure_check', (SELECT max(checked_at) FROM public.polymarket_closure_checks),
    'jobs', coalesce((SELECT jsonb_agg(jsonb_build_object('name',j.jobname,'active',j.active,'schedule',j.schedule,
      'last_status',(SELECT r.status FROM cron.job_run_details r WHERE r.jobid=j.jobid ORDER BY r.start_time DESC LIMIT 1),
      'last_run',(SELECT r.start_time FROM cron.job_run_details r WHERE r.jobid=j.jobid ORDER BY r.start_time DESC LIMIT 1)))
      FROM cron.job j WHERE j.jobname IN ('sync-polymarket-catalog','check-polymarket-closures')), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_catalog_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_catalog_health() TO authenticated;
NOTIFY pgrst, 'reload schema';
