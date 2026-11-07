-- Candidate migration: run on a disposable copy of the schema before publication.
BEGIN;
LOCK TABLE public.markets, public.market_options, public.market_settlements, public.market_price_history,
  public.contestations, public.user_contracts, public.transactions, public.user_favorites,
  public.comments, public.comment_likes, public.comment_reports, public.copied_trades,
  public.copy_trade_commissions, public.copy_subscriptions, public.copy_trade_settings,
  public.copy_traders, public.achievements, public.user_achievements IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE name text; rows_present boolean; actual_count bigint; item record;
BEGIN
  -- Refuse to discard user activity that appeared since the audit.
  FOREACH name IN ARRAY ARRAY['market_settlements','market_price_history','contestations','user_contracts',
    'transactions','user_favorites','comments','comment_likes','comment_reports','copied_trades',
    'copy_trade_commissions','copy_subscriptions','copy_traders','user_achievements'] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)',name) INTO rows_present;
    IF rows_present THEN RAISE EXCEPTION 'Legacy table % contains user data; migration stopped',name; END IF;
  END LOOP;
  -- These contain only the explicitly identified legacy definitions/configuration.
  FOR item IN SELECT * FROM (VALUES ('markets',6),('market_options',3),('achievements',40),('copy_trade_settings',1)) AS limits(table_name, max_rows) LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',item.table_name) INTO actual_count;
    IF actual_count > item.max_rows THEN RAISE EXCEPTION 'Legacy table % has more records than audited; migration stopped',item.table_name; END IF;
  END LOOP;
END $$;

-- Keep referral accounting while removing the obsolete achievement hook.
CREATE OR REPLACE FUNCTION public.update_commission_cache() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE referrer uuid;
BEGIN
  SELECT referrer_id INTO referrer FROM referrals WHERE id=NEW.referral_id;
  IF referrer IS NOT NULL THEN
    UPDATE profiles SET total_referral_commission=(SELECT coalesce(sum(rc.commission_amount),0)
      FROM referral_commissions rc JOIN referrals r ON r.id=rc.referral_id WHERE r.referrer_id=referrer), updated_at=now() WHERE id=referrer;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.update_referral_stats_cache() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE profiles SET total_referrals=(SELECT count(*) FROM referrals WHERE referrer_id=NEW.referrer_id),
    activated_referrals=(SELECT count(*) FROM referrals WHERE referrer_id=NEW.referrer_id AND status='ACTIVATED'),
    updated_at=now() WHERE id=NEW.referrer_id;
  RETURN NEW;
END $$;

ALTER TABLE public.profiles DROP CONSTRAINT profiles_copy_trader_id_fkey;
DROP TABLE public.comment_likes, public.comment_reports, public.comments,
  public.copy_trade_commissions, public.copied_trades, public.copy_subscriptions, public.copy_trade_settings, public.copy_traders,
  public.market_price_history, public.market_settlements, public.contestations, public.user_contracts,
  public.transactions, public.user_favorites, public.market_options, public.markets,
  public.user_achievements, public.achievements;

DO $$
DECLARE routine record;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY(ARRAY[
      'atomic_execute_multi_no_sell','atomic_execute_multi_no_trade','atomic_execute_multi_sell',
      'atomic_execute_multi_trade','atomic_execute_multi_trade_batch','atomic_execute_sell','atomic_execute_trade',
      'check_and_grant_achievements','check_suggestion_achievements','trigger_check_achievements',
      'notify_achievement_unlocked','process_market_settlement_achievements','recalculate_user_statistics',
      'process_market_payouts','record_price_after_trade','process_copy_trade_commissions',
      'atomic_subscribe_copy_trader','increment_trader_followers','update_copy_trader_follower_count',
      'sync_profile_copy_trader_status','protect_copy_subscription_fields','protect_copy_trader_fields',
      'update_copy_trader_timestamp','increment_comment_likes','decrement_comment_likes',
      'increment_replies_count','decrement_replies_count','trigger_notify_admin_new_contestation'
    ])
  LOOP EXECUTE format('DROP FUNCTION %s',routine.signature); END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
