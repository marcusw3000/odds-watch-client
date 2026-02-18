
-- ============================================================
-- GRUPO A: Revogar grants de tabelas admin-only
-- ============================================================
REVOKE INSERT, UPDATE, DELETE ON public.achievements FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_templates FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.fee_rules FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.market_options FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.market_settlements FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.markets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.copy_trade_settings FROM authenticated;

-- ============================================================
-- GRUPO B: Revogar grants de tabelas service_role-only
-- ============================================================
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_contracts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ledger_entries FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.fee_policy_snapshots FROM authenticated;

-- ============================================================
-- GRUPO C: Corrigir policies que usam raw_user_meta_data
-- ============================================================

-- event_templates: dropar 4 policies vulneraveis e recriar com has_role()
DROP POLICY IF EXISTS "Admins can create templates" ON public.event_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.event_templates;
DROP POLICY IF EXISTS "Admins can read all templates" ON public.event_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON public.event_templates;

CREATE POLICY "Admins can read all templates"
  ON public.event_templates FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create templates"
  ON public.event_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update templates"
  ON public.event_templates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete templates"
  ON public.event_templates FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- daily_volume_snapshots: dropar policy vulneravel (ja existe uma correta)
DROP POLICY IF EXISTS "Admins can read snapshots" ON public.daily_volume_snapshots;

-- ============================================================
-- GRUPO D: Corrigir policy permissiva de user_contracts
-- ============================================================
DROP POLICY IF EXISTS "Users can manage own contracts" ON public.user_contracts;

-- Garantir que a policy SELECT-only para usuarios existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_contracts' 
    AND policyname = 'Users can view own contracts'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own contracts" ON public.user_contracts FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END
$$;

-- Dropar policies permissivas de ledger_entries e fee_policy_snapshots
DROP POLICY IF EXISTS "Users can insert own ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Authenticated users can insert snapshots" ON public.fee_policy_snapshots;
