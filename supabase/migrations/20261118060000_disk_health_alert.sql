CREATE FUNCTION public.record_disk_health(p_percent numeric) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE state public.operational_alert_state; recipients integer; triggered boolean;
BEGIN
  IF p_percent IS NULL OR p_percent::text IN ('NaN','Infinity','-Infinity') OR p_percent < 0 OR p_percent > 100 THEN RAISE EXCEPTION 'Invalid disk usage'; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('disk-health-v1',0)) THEN RETURN; END IF;
  triggered := p_percent >= 80;
  SELECT count(DISTINCT user_id) INTO recipients FROM public.user_roles WHERE role='admin';
  SELECT * INTO state FROM public.operational_alert_state WHERE alert_key='disk_usage' FOR UPDATE;
  IF triggered AND recipients > 0 AND (NOT coalesce(state.active,false) OR state.last_sent_at IS NULL OR state.last_sent_at < now()-interval '6 hours') THEN
    INSERT INTO public.notifications(user_id,type,title,message,data)
    SELECT DISTINCT user_id,'SYSTEM_ANNOUNCEMENT'::public.notification_type,'Alerta de disco',format('Uso do disco de dados: %s%%. Verifique o painel de infraestrutura.',round(p_percent,1)),jsonb_build_object('alert_key','disk_usage') FROM public.user_roles WHERE role='admin';
    INSERT INTO public.operational_alert_state(alert_key,active,last_sent_at,checked_at) VALUES('disk_usage',true,now(),now()) ON CONFLICT(alert_key) DO UPDATE SET active=true,last_sent_at=now(),checked_at=now();
  ELSE
    INSERT INTO public.operational_alert_state(alert_key,active,checked_at) VALUES('disk_usage',triggered,now()) ON CONFLICT(alert_key) DO UPDATE SET active=triggered,checked_at=now();
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_disk_health(numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_disk_health(numeric) TO service_role;
