-- Create leaderboard opt-in profiles
CREATE TABLE public.leaderboard_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  show_profit BOOLEAN NOT NULL DEFAULT true,
  show_roi BOOLEAN NOT NULL DEFAULT true,
  show_volume BOOLEAN NOT NULL DEFAULT true,
  show_trades BOOLEAN NOT NULL DEFAULT true,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user statistics (cached/aggregated)
CREATE TABLE public.user_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_profit NUMERIC NOT NULL DEFAULT 0,
  total_volume NUMERIC NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  roi_percent NUMERIC NOT NULL DEFAULT 0,
  best_trade_profit NUMERIC NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create achievements/badges
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  points INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user achievements (junction table)
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.leaderboard_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Leaderboard profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
ON public.leaderboard_profiles FOR SELECT
USING (is_public = true);

CREATE POLICY "Users can view own profile"
ON public.leaderboard_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own profile"
ON public.leaderboard_profiles FOR ALL
USING (auth.uid() = user_id);

-- User statistics policies
CREATE POLICY "Stats visible if profile is public"
ON public.user_statistics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leaderboard_profiles lp
    WHERE lp.user_id = user_statistics.user_id AND lp.is_public = true
  )
);

CREATE POLICY "Users can view own stats"
ON public.user_statistics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage stats"
ON public.user_statistics FOR ALL
USING (auth.uid() IS NOT NULL);

-- Achievements policies
CREATE POLICY "Achievements are publicly readable"
ON public.achievements FOR SELECT
USING (true);

CREATE POLICY "Admins can manage achievements"
ON public.achievements FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- User achievements policies
CREATE POLICY "User achievements visible if profile public"
ON public.user_achievements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leaderboard_profiles lp
    WHERE lp.user_id = user_achievements.user_id AND lp.is_public = true
  )
);

CREATE POLICY "Users can view own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can grant achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create update trigger for leaderboard_profiles
CREATE TRIGGER update_leaderboard_profiles_updated_at
BEFORE UPDATE ON public.leaderboard_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default achievements
INSERT INTO public.achievements (code, name, description, icon, category, points) VALUES
('first_trade', 'Primeiro Trade', 'Realizou seu primeiro trade na plataforma', '🎯', 'trading', 10),
('10_trades', 'Trader Iniciante', 'Completou 10 trades', '📈', 'trading', 25),
('50_trades', 'Trader Experiente', 'Completou 50 trades', '🚀', 'trading', 50),
('100_trades', 'Trader Veterano', 'Completou 100 trades', '🏆', 'trading', 100),
('first_profit', 'Lucro Inicial', 'Obteve lucro em um trade', '💰', 'profit', 10),
('profit_100', 'Centenário', 'Acumulou R$100 em lucros', '💵', 'profit', 50),
('profit_1000', 'Milhar', 'Acumulou R$1.000 em lucros', '💎', 'profit', 100),
('win_streak_3', 'Hat Trick', '3 trades lucrativos consecutivos', '🔥', 'streak', 25),
('win_streak_5', 'Em Chamas', '5 trades lucrativos consecutivos', '⚡', 'streak', 50),
('win_streak_10', 'Imparável', '10 trades lucrativos consecutivos', '🌟', 'streak', 100),
('top_10_monthly', 'Top 10 Mensal', 'Ficou entre os 10 melhores do mês', '🥇', 'leaderboard', 100),
('top_3_monthly', 'Pódio Mensal', 'Ficou entre os 3 melhores do mês', '👑', 'leaderboard', 200),
('volume_1000', 'Volume Bronze', 'Negociou R$1.000 em volume', '🥉', 'volume', 25),
('volume_10000', 'Volume Prata', 'Negociou R$10.000 em volume', '🥈', 'volume', 75),
('volume_100000', 'Volume Ouro', 'Negociou R$100.000 em volume', '🥇', 'volume', 150),
('early_adopter', 'Early Adopter', 'Um dos primeiros usuários da plataforma', '🌱', 'special', 50);