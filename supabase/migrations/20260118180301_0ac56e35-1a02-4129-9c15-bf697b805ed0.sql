-- =====================================================
-- COPY TRADE SYSTEM - Complete Schema
-- =====================================================

-- 1. Global settings table (admin configurable)
CREATE TABLE public.copy_trade_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Subscription defaults
  default_monthly_fee NUMERIC NOT NULL DEFAULT 19.90,
  default_profit_share_percent NUMERIC NOT NULL DEFAULT 10,
  -- Revenue split (admin configurable)
  default_trader_split NUMERIC NOT NULL DEFAULT 50,
  default_platform_split NUMERIC NOT NULL DEFAULT 50,
  -- Limits
  min_trader_split NUMERIC NOT NULL DEFAULT 30,
  max_trader_split NUMERIC NOT NULL DEFAULT 70,
  -- Metadata
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure only one row
  CONSTRAINT single_settings CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid),
  -- Ensure splits sum to 100
  CONSTRAINT valid_splits CHECK (default_trader_split + default_platform_split = 100),
  CONSTRAINT valid_split_range CHECK (
    default_trader_split >= min_trader_split AND 
    default_trader_split <= max_trader_split
  )
);

-- Insert default settings
INSERT INTO public.copy_trade_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001'::uuid);

-- 2. Copy traders table (influencers approved by admin)
CREATE TABLE public.copy_traders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED')),
  rejection_reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  -- Stats (cached for performance)
  total_followers INTEGER NOT NULL DEFAULT 0,
  total_trades_copied INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  -- Custom settings (override global if set)
  monthly_fee NUMERIC,
  profit_share_percent NUMERIC,
  custom_trader_split NUMERIC,
  custom_platform_split NUMERIC,
  -- Stripe integration
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Validate custom splits
  CONSTRAINT valid_custom_splits CHECK (
    (custom_trader_split IS NULL AND custom_platform_split IS NULL) OR
    (custom_trader_split IS NOT NULL AND custom_platform_split IS NOT NULL AND 
     custom_trader_split + custom_platform_split = 100)
  )
);

-- 3. Copy subscriptions (followers)
CREATE TABLE public.copy_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id),
  trader_id UUID NOT NULL REFERENCES public.copy_traders(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAUSED')),
  -- Execution mode
  auto_copy BOOLEAN NOT NULL DEFAULT true,
  max_trade_amount NUMERIC DEFAULT 100,
  copy_percentage NUMERIC DEFAULT 100, -- % of trader's trade to copy
  -- Stripe
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  -- Stats
  total_trades_copied INTEGER NOT NULL DEFAULT 0,
  total_profit NUMERIC NOT NULL DEFAULT 0,
  total_commission_paid NUMERIC NOT NULL DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  -- Unique subscription per follower-trader pair
  CONSTRAINT unique_subscription UNIQUE (follower_id, trader_id)
);

-- 4. Copied trades
CREATE TABLE public.copied_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.copy_subscriptions(id),
  original_transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  copied_transaction_id UUID REFERENCES public.transactions(id),
  -- Trade info
  market_id UUID NOT NULL REFERENCES public.markets(id),
  outcome TEXT NOT NULL,
  original_amount NUMERIC NOT NULL,
  copied_amount NUMERIC NOT NULL,
  original_price NUMERIC NOT NULL,
  copied_price NUMERIC,
  -- Status
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'SKIPPED', 'FAILED', 'NOTIFIED')),
  skip_reason TEXT,
  failure_reason TEXT,
  -- Profit tracking
  is_settled BOOLEAN NOT NULL DEFAULT false,
  profit_amount NUMERIC,
  commission_processed BOOLEAN NOT NULL DEFAULT false,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);

-- 5. Copy trade commissions
CREATE TABLE public.copy_trade_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copied_trade_id UUID NOT NULL REFERENCES public.copied_trades(id),
  trader_id UUID NOT NULL REFERENCES public.copy_traders(id),
  follower_id UUID NOT NULL REFERENCES auth.users(id),
  -- Amounts
  profit_amount NUMERIC NOT NULL,
  profit_share_percent NUMERIC NOT NULL,
  commission_total NUMERIC NOT NULL,
  trader_split_percent NUMERIC NOT NULL,
  platform_split_percent NUMERIC NOT NULL,
  trader_share NUMERIC NOT NULL,
  platform_share NUMERIC NOT NULL,
  -- Ledger references
  trader_ledger_id UUID REFERENCES public.ledger_entries(id),
  platform_ledger_id UUID REFERENCES public.ledger_entries(id),
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Add copy trader reference to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_copy_trader BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS copy_trader_id UUID REFERENCES public.copy_traders(id);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_copy_traders_status ON public.copy_traders(status);
CREATE INDEX idx_copy_traders_user_id ON public.copy_traders(user_id);
CREATE INDEX idx_copy_subscriptions_follower ON public.copy_subscriptions(follower_id);
CREATE INDEX idx_copy_subscriptions_trader ON public.copy_subscriptions(trader_id);
CREATE INDEX idx_copy_subscriptions_status ON public.copy_subscriptions(status);
CREATE INDEX idx_copied_trades_subscription ON public.copied_trades(subscription_id);
CREATE INDEX idx_copied_trades_original_tx ON public.copied_trades(original_transaction_id);
CREATE INDEX idx_copied_trades_status ON public.copied_trades(status);
CREATE INDEX idx_copied_trades_market ON public.copied_trades(market_id);
CREATE INDEX idx_copy_commissions_trader ON public.copy_trade_commissions(trader_id);
CREATE INDEX idx_copy_commissions_follower ON public.copy_trade_commissions(follower_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.copy_trade_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copied_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_trade_commissions ENABLE ROW LEVEL SECURITY;

-- copy_trade_settings: Read by all, write by admin
CREATE POLICY "Anyone can view copy trade settings"
  ON public.copy_trade_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update copy trade settings"
  ON public.copy_trade_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- copy_traders: Read approved by all, write own or admin
CREATE POLICY "Anyone can view approved copy traders"
  ON public.copy_traders FOR SELECT
  USING (status = 'APPROVED' OR user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can apply as copy trader"
  ON public.copy_traders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Traders can update own profile"
  ON public.copy_traders FOR UPDATE
  USING (user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- copy_subscriptions: Users see own subscriptions, traders see their followers
CREATE POLICY "Users can view own subscriptions"
  ON public.copy_subscriptions FOR SELECT
  USING (
    follower_id = auth.uid() OR
    trader_id IN (SELECT id FROM public.copy_traders WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create subscriptions"
  ON public.copy_subscriptions FOR INSERT
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
  ON public.copy_subscriptions FOR UPDATE
  USING (follower_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- copied_trades: Users see own copied trades
CREATE POLICY "Users can view own copied trades"
  ON public.copied_trades FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM public.copy_subscriptions 
      WHERE follower_id = auth.uid() OR 
            trader_id IN (SELECT id FROM public.copy_traders WHERE user_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- copy_trade_commissions: Users see own commissions
CREATE POLICY "Users can view own commissions"
  ON public.copy_trade_commissions FOR SELECT
  USING (
    follower_id = auth.uid() OR
    trader_id IN (SELECT id FROM public.copy_traders WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update copy_traders updated_at
CREATE OR REPLACE FUNCTION public.update_copy_trader_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_copy_traders_timestamp
  BEFORE UPDATE ON public.copy_traders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_copy_trader_timestamp();

-- Function to update copy_subscriptions updated_at
CREATE TRIGGER update_copy_subscriptions_timestamp
  BEFORE UPDATE ON public.copy_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_copy_trader_timestamp();

-- Function to update follower count when subscription changes
CREATE OR REPLACE FUNCTION public.update_copy_trader_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.copy_traders 
    SET total_followers = total_followers + 1
    WHERE id = NEW.trader_id AND NEW.status = 'ACTIVE';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Decrement if was active, now not
    IF OLD.status = 'ACTIVE' AND NEW.status != 'ACTIVE' THEN
      UPDATE public.copy_traders 
      SET total_followers = GREATEST(0, total_followers - 1)
      WHERE id = NEW.trader_id;
    -- Increment if was not active, now active
    ELSIF OLD.status != 'ACTIVE' AND NEW.status = 'ACTIVE' THEN
      UPDATE public.copy_traders 
      SET total_followers = total_followers + 1
      WHERE id = NEW.trader_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'ACTIVE' THEN
      UPDATE public.copy_traders 
      SET total_followers = GREATEST(0, total_followers - 1)
      WHERE id = OLD.trader_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER manage_copy_trader_followers
  AFTER INSERT OR UPDATE OR DELETE ON public.copy_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_copy_trader_follower_count();

-- Function to sync profile is_copy_trader status
CREATE OR REPLACE FUNCTION public.sync_profile_copy_trader_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET 
      is_copy_trader = (NEW.status = 'APPROVED'),
      copy_trader_id = CASE WHEN NEW.status = 'APPROVED' THEN NEW.id ELSE NULL END
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_copy_trader_profile
  AFTER INSERT OR UPDATE ON public.copy_traders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_copy_trader_status();