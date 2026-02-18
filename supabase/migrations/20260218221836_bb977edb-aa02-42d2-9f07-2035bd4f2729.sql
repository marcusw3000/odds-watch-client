
-- =====================================================
-- SECURITY HARDENING: Revoke excessive grants across all tables
-- =====================================================

-- =====================================================
-- STEP 1: REVOKE all writes from anon on ALL public tables
-- (anon should NEVER write to any table)
-- =====================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- =====================================================
-- STEP 2: REVOKE writes from authenticated on service_role-only tables
-- These tables should ONLY be written via Edge Functions (service_role)
-- =====================================================
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.platform_revenue FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.market_price_history FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bcb_data_cache FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.daily_volume_snapshots FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.copied_trades FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.copy_trade_commissions FROM authenticated;

-- =====================================================
-- STEP 3: Ensure SELECT is granted for tables that need public/authenticated reads
-- =====================================================
GRANT SELECT ON public.wallets TO authenticated;
GRANT SELECT ON public.platform_revenue TO authenticated;
GRANT SELECT ON public.market_price_history TO anon, authenticated;
GRANT SELECT ON public.bcb_data_cache TO anon, authenticated;
GRANT SELECT ON public.daily_volume_snapshots TO authenticated;
GRANT SELECT ON public.copied_trades TO authenticated;
GRANT SELECT ON public.copy_trade_commissions TO authenticated;

-- Ensure anon can still SELECT public-readable tables
GRANT SELECT ON public.markets TO anon, authenticated;
GRANT SELECT ON public.market_options TO anon, authenticated;
GRANT SELECT ON public.market_settlements TO anon, authenticated;
GRANT SELECT ON public.fee_rules TO anon, authenticated;
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT SELECT ON public.comment_likes TO anon, authenticated;
GRANT SELECT ON public.fee_policy_snapshots TO anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.copy_traders TO anon, authenticated;
GRANT SELECT ON public.copy_trade_settings TO anon, authenticated;

-- =====================================================
-- STEP 4: Fix broken RLS policies on platform_revenue
-- Remove overly permissive "any authenticated user can write" policies
-- =====================================================
DROP POLICY IF EXISTS "System can aggregate revenue" ON public.platform_revenue;
DROP POLICY IF EXISTS "System can update revenue" ON public.platform_revenue;

-- After revoking grants, these policies are moot, but clean them up for clarity.
-- platform_revenue writes now only happen via service_role (Edge Functions).

-- =====================================================
-- STEP 5: Fix referrals UPDATE policy if it exists
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'referrals' 
    AND schemaname = 'public'
    AND policyname = 'System can update referrals'
  ) THEN
    EXECUTE 'DROP POLICY "System can update referrals" ON public.referrals';
  END IF;
END $$;

-- =====================================================
-- STEP 6: Fix user_achievements INSERT policy if it exists
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_achievements' 
    AND schemaname = 'public'
    AND policyname ILIKE '%authenticated%insert%'
  ) THEN
    -- Revoke writes - achievements are granted via triggers/service_role only
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.user_achievements TO authenticated';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_achievements') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.user_achievements TO anon, authenticated';
  END IF;
END $$;

-- =====================================================
-- STEP 7: Fix referral_commissions if it exists
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'referral_commissions') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.referral_commissions FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.referral_commissions TO authenticated';
  END IF;
END $$;
