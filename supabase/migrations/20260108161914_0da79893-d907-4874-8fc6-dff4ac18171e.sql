-- Enum para tipo de liquidação
CREATE TYPE settlement_type AS ENUM ('MANUAL', 'SELIC', 'SELIC_META', 'IPCA', 'CDI', 'PTAX');

-- Enum para status do mercado
CREATE TYPE market_status AS ENUM ('OPEN', 'HALTED', 'PENDING', 'CONTESTED', 'SETTLED');

-- Tabela principal de mercados
CREATE TABLE public.markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'economia',
  image_url TEXT,
  status market_status NOT NULL DEFAULT 'OPEN',
  settlement_type settlement_type NOT NULL DEFAULT 'MANUAL',
  settlement_config JSONB DEFAULT '{}',
  current_yes_price DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  current_no_price DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  total_volume DECIMAL(12,2) NOT NULL DEFAULT 0,
  liquidity_pool DECIMAL(12,2) NOT NULL DEFAULT 10000,
  lmsr_b DECIMAL(10,2) NOT NULL DEFAULT 100,
  yes_shares DECIMAL(12,4) NOT NULL DEFAULT 0,
  no_shares DECIMAL(12,4) NOT NULL DEFAULT 0,
  result TEXT CHECK (result IN ('YES', 'NO')),
  result_source TEXT,
  close_date TIMESTAMP WITH TIME ZONE,
  settlement_date TIMESTAMP WITH TIME ZONE,
  halt_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de liquidações (histórico)
CREATE TABLE public.market_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('YES', 'NO')),
  source TEXT NOT NULL,
  api_value DECIMAL(12,4),
  api_response JSONB,
  settled_by UUID REFERENCES auth.users(id),
  settled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_automatic BOOLEAN NOT NULL DEFAULT false
);

-- Cache de dados do BCB
CREATE TABLE public.bcb_data_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator TEXT NOT NULL,
  reference_date DATE NOT NULL,
  value DECIMAL(12,4) NOT NULL,
  raw_response JSONB,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(indicator, reference_date)
);

-- Contratos dos usuários
CREATE TABLE public.user_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('YES', 'NO')),
  shares DECIMAL(12,4) NOT NULL,
  average_price DECIMAL(5,4) NOT NULL,
  total_invested DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, market_id, position)
);

-- Transações
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'PAYOUT', 'REFUND')),
  position TEXT CHECK (position IN ('YES', 'NO')),
  shares DECIMAL(12,4),
  price_per_share DECIMAL(5,4),
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contestações
CREATE TABLE public.contestations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Saldo dos usuários
CREATE TABLE public.user_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 1000,
  total_deposited DECIMAL(12,2) NOT NULL DEFAULT 1000,
  total_withdrawn DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bcb_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

-- Markets: público para leitura, admins para escrita
CREATE POLICY "Markets are publicly readable" ON public.markets
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage markets" ON public.markets
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Market Settlements: público para leitura
CREATE POLICY "Settlements are publicly readable" ON public.market_settlements
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage settlements" ON public.market_settlements
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- BCB Cache: público para leitura
CREATE POLICY "BCB cache is publicly readable" ON public.bcb_data_cache
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage BCB cache" ON public.bcb_data_cache
  FOR ALL USING (true);

-- User Contracts: usuário vê os próprios
CREATE POLICY "Users can view own contracts" ON public.user_contracts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own contracts" ON public.user_contracts
  FOR ALL USING (auth.uid() = user_id);

-- Transactions: usuário vê as próprias
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Contestations: usuário vê as próprias, admins veem todas
CREATE POLICY "Users can view own contestations" ON public.contestations
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create contestations" ON public.contestations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage contestations" ON public.contestations
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- User Balances: usuário vê o próprio
CREATE POLICY "Users can view own balance" ON public.user_balances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own balance" ON public.user_balances
  FOR ALL USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_markets_updated_at
  BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_contracts_updated_at
  BEFORE UPDATE ON public.user_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_balances_updated_at
  BEFORE UPDATE ON public.user_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Criar saldo inicial para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_balances (user_id, balance, total_deposited)
  VALUES (NEW.id, 1000, 1000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Índices para performance
CREATE INDEX idx_markets_status ON public.markets(status);
CREATE INDEX idx_markets_settlement_type ON public.markets(settlement_type);
CREATE INDEX idx_user_contracts_user_id ON public.user_contracts(user_id);
CREATE INDEX idx_user_contracts_market_id ON public.user_contracts(market_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_market_id ON public.transactions(market_id);
CREATE INDEX idx_bcb_cache_indicator_date ON public.bcb_data_cache(indicator, reference_date);
CREATE INDEX idx_contestations_market_id ON public.contestations(market_id);
CREATE INDEX idx_contestations_status ON public.contestations(status);