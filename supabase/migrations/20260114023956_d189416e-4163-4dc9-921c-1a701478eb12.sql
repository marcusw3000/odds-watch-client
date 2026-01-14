-- ============================================
-- SISTEMA FINANCEIRO - ADMIN + CORE
-- Mercado de Predições (estilo Kalshi)
-- ============================================

-- 1. WALLETS (carteiras dos usuários)
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  balance_available numeric NOT NULL DEFAULT 0,
  balance_locked numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. FEE_RULES (regras de taxas - controlável pelo admin)
CREATE TABLE IF NOT EXISTS public.fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW', 'TRADE', 'SETTLEMENT')),
  mode text NOT NULL CHECK (mode IN ('PERCENT', 'FIXED', 'TIERED')),
  tiers jsonb DEFAULT '[]'::jsonb,
  flat_value numeric,
  percent_value numeric,
  min_fee numeric,
  max_fee numeric,
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. FEE_POLICY_SNAPSHOT (snapshot aplicado em cada transação)
CREATE TABLE IF NOT EXISTS public.fee_policy_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_rule_id uuid REFERENCES public.fee_rules(id),
  type text NOT NULL,
  applied_mode text NOT NULL,
  applied_tiers jsonb,
  applied_percent numeric,
  applied_flat numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. LEDGER_ENTRIES (histórico financeiro principal - IMUTÁVEL)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  wallet_id uuid REFERENCES public.wallets(id),
  ref_type text NOT NULL CHECK (ref_type IN ('DEPOSIT', 'WITHDRAW', 'TRADE', 'SETTLEMENT', 'FEE', 'ADJUSTMENT')),
  ref_id uuid,
  direction text NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  amount numeric NOT NULL,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  platform_revenue numeric NOT NULL DEFAULT 0,
  fee_snapshot_id uuid REFERENCES public.fee_policy_snapshots(id),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. PLATFORM_REVENUE (agregado de receita)
CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  type text NOT NULL,
  gross numeric NOT NULL DEFAULT 0,
  fees numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(day, type)
);

-- 6. ADMIN_AUDIT_LOGS (histórico de ações admin)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 7. Adicionar campos ao markets existente para settlement config
ALTER TABLE public.markets 
ADD COLUMN IF NOT EXISTS resolution jsonb,
ADD COLUMN IF NOT EXISTS settled_by uuid;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_policy_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- WALLETS policies
CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets" ON public.wallets
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage wallets" ON public.wallets
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- FEE_RULES policies
CREATE POLICY "Fee rules are publicly readable" ON public.fee_rules
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage fee rules" ON public.fee_rules
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- FEE_POLICY_SNAPSHOTS policies
CREATE POLICY "Snapshots are publicly readable" ON public.fee_policy_snapshots
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert snapshots" ON public.fee_policy_snapshots
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- LEDGER_ENTRIES policies
CREATE POLICY "Users can view own ledger entries" ON public.ledger_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ledger entries" ON public.ledger_entries
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert ledger entries" ON public.ledger_entries
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Block updates and deletes on ledger (immutable)
CREATE POLICY "Ledger entries cannot be updated" ON public.ledger_entries
  FOR UPDATE USING (false);

CREATE POLICY "Ledger entries cannot be deleted" ON public.ledger_entries
  FOR DELETE USING (false);

-- PLATFORM_REVENUE policies
CREATE POLICY "Admins can view platform revenue" ON public.platform_revenue
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage platform revenue" ON public.platform_revenue
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ADMIN_AUDIT_LOGS policies
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for wallets
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at for platform_revenue
CREATE TRIGGER update_platform_revenue_updated_at
  BEFORE UPDATE ON public.platform_revenue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED DATA - Default Fee Rules
-- ============================================

-- DEPOSIT rule (TIERED)
INSERT INTO public.fee_rules (name, type, mode, tiers, is_active, effective_from)
VALUES (
  'Taxa de Depósito Padrão',
  'DEPOSIT',
  'TIERED',
  '[{"min": 0, "max": 500, "percent": 0.03}, {"min": 500, "max": 1000, "percent": 0.02}, {"min": 1000, "max": null, "percent": 0.01}]'::jsonb,
  true,
  now()
);

-- WITHDRAW rule (TIERED)
INSERT INTO public.fee_rules (name, type, mode, tiers, is_active, effective_from)
VALUES (
  'Taxa de Saque Padrão',
  'WITHDRAW',
  'TIERED',
  '[{"min": 0, "max": 500, "percent": 0.05}, {"min": 500, "max": 1000, "percent": 0.03}, {"min": 1000, "max": null, "percent": 0.02}]'::jsonb,
  true,
  now()
);

-- TRADE rule (PERCENT)
INSERT INTO public.fee_rules (name, type, mode, percent_value, is_active, effective_from)
VALUES (
  'Taxa de Trade Padrão',
  'TRADE',
  'PERCENT',
  0.01,
  true,
  now()
);

-- SETTLEMENT rule (PERCENT)
INSERT INTO public.fee_rules (name, type, mode, percent_value, is_active, effective_from)
VALUES (
  'Taxa de Liquidação Padrão',
  'SETTLEMENT',
  'PERCENT',
  0.005,
  true,
  now()
);