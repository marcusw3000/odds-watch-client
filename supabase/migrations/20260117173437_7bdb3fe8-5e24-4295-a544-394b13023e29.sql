-- =====================================================
-- SISTEMA DE VOTAÇÃO DE SUGESTÕES DE MERCADOS
-- =====================================================

-- Tabela principal de sugestões
CREATE TABLE public.market_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  status text NOT NULL DEFAULT 'PENDING',
  score integer NOT NULL DEFAULT 0,
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  admin_notes text,
  market_id uuid REFERENCES public.markets(id),
  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED'))
);

-- Tabela de votos em sugestões
CREATE TABLE public.suggestion_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.market_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote_value integer NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

-- Tabela de comentários em sugestões
CREATE TABLE public.suggestion_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.market_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.suggestion_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  replies_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_hidden boolean NOT NULL DEFAULT false
);

-- Tabela de likes em comentários de sugestões
CREATE TABLE public.suggestion_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.suggestion_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Índices para performance
CREATE INDEX idx_market_suggestions_status ON public.market_suggestions(status);
CREATE INDEX idx_market_suggestions_score ON public.market_suggestions(score DESC);
CREATE INDEX idx_market_suggestions_user ON public.market_suggestions(user_id);
CREATE INDEX idx_market_suggestions_created ON public.market_suggestions(created_at DESC);
CREATE INDEX idx_suggestion_votes_suggestion ON public.suggestion_votes(suggestion_id);
CREATE INDEX idx_suggestion_votes_user ON public.suggestion_votes(user_id);
CREATE INDEX idx_suggestion_comments_suggestion ON public.suggestion_comments(suggestion_id);
CREATE INDEX idx_suggestion_comments_parent ON public.suggestion_comments(parent_id);

-- Habilitar RLS
ALTER TABLE public.market_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_comment_likes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS - market_suggestions
-- =====================================================

-- Todos podem ver sugestões não rejeitadas (ou suas próprias)
CREATE POLICY "Suggestions are viewable by everyone except rejected"
ON public.market_suggestions
FOR SELECT
USING (status != 'REJECTED' OR user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Usuários autenticados podem criar sugestões
CREATE POLICY "Users can create suggestions"
ON public.market_suggestions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Autor pode atualizar sua sugestão se ainda PENDING
CREATE POLICY "Users can update own pending suggestions"
ON public.market_suggestions
FOR UPDATE
USING (auth.uid() = user_id AND status = 'PENDING');

-- Admins podem gerenciar todas sugestões
CREATE POLICY "Admins can manage all suggestions"
ON public.market_suggestions
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Autor pode deletar sugestão se PENDING
CREATE POLICY "Users can delete own pending suggestions"
ON public.market_suggestions
FOR DELETE
USING (auth.uid() = user_id AND status = 'PENDING');

-- =====================================================
-- POLÍTICAS RLS - suggestion_votes
-- =====================================================

-- Votos são públicos
CREATE POLICY "Votes are publicly readable"
ON public.suggestion_votes
FOR SELECT
USING (true);

-- Usuários autenticados podem votar
CREATE POLICY "Users can create votes"
ON public.suggestion_votes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar próprio voto
CREATE POLICY "Users can update own votes"
ON public.suggestion_votes
FOR UPDATE
USING (auth.uid() = user_id);

-- Usuários podem remover próprio voto
CREATE POLICY "Users can delete own votes"
ON public.suggestion_votes
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- POLÍTICAS RLS - suggestion_comments
-- =====================================================

-- Comentários visíveis são públicos
CREATE POLICY "Comments are publicly readable"
ON public.suggestion_comments
FOR SELECT
USING (is_hidden = false OR user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Usuários podem criar comentários
CREATE POLICY "Users can create comments"
ON public.suggestion_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar próprios comentários
CREATE POLICY "Users can update own comments"
ON public.suggestion_comments
FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Usuários podem deletar próprios comentários
CREATE POLICY "Users can delete own comments"
ON public.suggestion_comments
FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- =====================================================
-- POLÍTICAS RLS - suggestion_comment_likes
-- =====================================================

CREATE POLICY "Comment likes are publicly readable"
ON public.suggestion_comment_likes
FOR SELECT
USING (true);

CREATE POLICY "Users can like comments"
ON public.suggestion_comment_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments"
ON public.suggestion_comment_likes
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- FUNÇÕES
-- =====================================================

-- Função para votar em uma sugestão
CREATE OR REPLACE FUNCTION public.vote_on_suggestion(
  p_suggestion_id uuid,
  p_vote_value integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_vote integer;
  v_new_upvotes integer;
  v_new_downvotes integer;
  v_new_score integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_vote_value NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'Invalid vote value. Must be -1 or 1';
  END IF;

  -- Verificar voto existente
  SELECT vote_value INTO v_existing_vote
  FROM suggestion_votes
  WHERE suggestion_id = p_suggestion_id AND user_id = v_user_id;

  IF v_existing_vote IS NOT NULL THEN
    IF v_existing_vote = p_vote_value THEN
      -- Mesmo voto: remover voto
      DELETE FROM suggestion_votes
      WHERE suggestion_id = p_suggestion_id AND user_id = v_user_id;
    ELSE
      -- Voto diferente: atualizar
      UPDATE suggestion_votes
      SET vote_value = p_vote_value, created_at = now()
      WHERE suggestion_id = p_suggestion_id AND user_id = v_user_id;
    END IF;
  ELSE
    -- Novo voto
    INSERT INTO suggestion_votes (suggestion_id, user_id, vote_value)
    VALUES (p_suggestion_id, v_user_id, p_vote_value);
  END IF;

  -- Recalcular contagens
  SELECT 
    COALESCE(SUM(CASE WHEN vote_value = 1 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN vote_value = -1 THEN 1 ELSE 0 END), 0)
  INTO v_new_upvotes, v_new_downvotes
  FROM suggestion_votes
  WHERE suggestion_id = p_suggestion_id;

  v_new_score := v_new_upvotes - v_new_downvotes;

  UPDATE market_suggestions
  SET 
    upvotes = v_new_upvotes,
    downvotes = v_new_downvotes,
    score = v_new_score,
    updated_at = now()
  WHERE id = p_suggestion_id;

  -- Verificar conquistas do autor da sugestão
  PERFORM check_and_grant_achievements((SELECT user_id FROM market_suggestions WHERE id = p_suggestion_id));

  RETURN jsonb_build_object(
    'success', true,
    'upvotes', v_new_upvotes,
    'downvotes', v_new_downvotes,
    'score', v_new_score,
    'user_vote', (SELECT vote_value FROM suggestion_votes WHERE suggestion_id = p_suggestion_id AND user_id = v_user_id)
  );
END;
$$;

-- Função para buscar sugestões trending
CREATE OR REPLACE FUNCTION public.get_trending_suggestions(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  description text,
  category text,
  status text,
  score integer,
  upvotes integer,
  downvotes integer,
  comment_count integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  market_id uuid,
  author_name text,
  author_avatar text,
  user_vote integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT 
    ms.id,
    ms.user_id,
    ms.title,
    ms.description,
    ms.category,
    ms.status,
    ms.score,
    ms.upvotes,
    ms.downvotes,
    ms.comment_count,
    ms.created_at,
    ms.updated_at,
    ms.market_id,
    COALESCE(p.display_name, p.full_name, 'Usuário') as author_name,
    p.avatar_url as author_avatar,
    sv.vote_value as user_vote
  FROM market_suggestions ms
  LEFT JOIN profiles p ON p.id = ms.user_id
  LEFT JOIN suggestion_votes sv ON sv.suggestion_id = ms.id AND sv.user_id = v_user_id
  WHERE 
    (ms.status != 'REJECTED' OR ms.user_id = v_user_id OR has_role(v_user_id, 'admin'))
    AND (p_status IS NULL OR ms.status = p_status)
    AND (p_category IS NULL OR ms.category = p_category)
  ORDER BY ms.score DESC, ms.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Função para atualizar contagem de comentários
CREATE OR REPLACE FUNCTION public.update_suggestion_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE market_suggestions
    SET comment_count = comment_count + 1, updated_at = now()
    WHERE id = NEW.suggestion_id;
    
    -- Atualizar replies_count do parent se existir
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE suggestion_comments
      SET replies_count = replies_count + 1
      WHERE id = NEW.parent_id;
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE market_suggestions
    SET comment_count = GREATEST(0, comment_count - 1), updated_at = now()
    WHERE id = OLD.suggestion_id;
    
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE suggestion_comments
      SET replies_count = GREATEST(0, replies_count - 1)
      WHERE id = OLD.parent_id;
    END IF;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_suggestion_comment_count
AFTER INSERT OR DELETE ON public.suggestion_comments
FOR EACH ROW EXECUTE FUNCTION public.update_suggestion_comment_count();

-- Função para atualizar likes de comentários
CREATE OR REPLACE FUNCTION public.update_suggestion_comment_likes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE suggestion_comments
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE suggestion_comments
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_suggestion_comment_likes
AFTER INSERT OR DELETE ON public.suggestion_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.update_suggestion_comment_likes();

-- =====================================================
-- CAMPOS PARA CONQUISTAS NO PROFILES
-- =====================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suggestions_created integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS suggestions_approved integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS suggestions_implemented integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_suggestion_score integer DEFAULT 0;

-- =====================================================
-- NOVAS CONQUISTAS DE SUGESTÕES
-- =====================================================

INSERT INTO achievements (code, name, description, icon, category, points) VALUES
  ('suggestion_first', 'Visionário', 'Criou sua primeira sugestão de mercado', '💡', 'community', 10),
  ('suggestion_5', 'Idealizador', 'Criou 5 sugestões de mercados', '🧠', 'community', 25),
  ('suggestion_approved', 'Aceito', 'Teve uma sugestão aprovada', '✅', 'community', 30),
  ('suggestion_implemented', 'Criador', 'Sugestão virou um mercado real', '🏆', 'community', 50),
  ('suggestion_popular', 'Popular', 'Sugestão com 50+ votos positivos', '🌟', 'community', 40)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- ATUALIZAR check_and_grant_achievements
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_and_grant_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_achievement achievements%ROWTYPE;
  v_should_grant boolean;
  v_suggestions_created integer;
  v_suggestions_approved integer;
  v_suggestions_implemented integer;
  v_best_suggestion_score integer;
BEGIN
  -- Buscar perfil do usuário
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN;
  END IF;

  -- Calcular estatísticas de sugestões
  SELECT COUNT(*) INTO v_suggestions_created
  FROM market_suggestions WHERE user_id = p_user_id;
  
  SELECT COUNT(*) INTO v_suggestions_approved
  FROM market_suggestions WHERE user_id = p_user_id AND status IN ('APPROVED', 'IMPLEMENTED');
  
  SELECT COUNT(*) INTO v_suggestions_implemented
  FROM market_suggestions WHERE user_id = p_user_id AND status = 'IMPLEMENTED';
  
  SELECT COALESCE(MAX(score), 0) INTO v_best_suggestion_score
  FROM market_suggestions WHERE user_id = p_user_id;
  
  -- Atualizar cache no profile
  UPDATE profiles SET
    suggestions_created = v_suggestions_created,
    suggestions_approved = v_suggestions_approved,
    suggestions_implemented = v_suggestions_implemented,
    best_suggestion_score = v_best_suggestion_score
  WHERE id = p_user_id;

  -- Iterar sobre todas as conquistas ativas
  FOR v_achievement IN SELECT * FROM achievements WHERE is_active = true LOOP
    v_should_grant := false;
    
    -- Verificar se já possui a conquista
    IF EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = v_achievement.id) THEN
      CONTINUE;
    END IF;
    
    -- Verificar cada conquista
    CASE v_achievement.code
      -- Trading achievements
      WHEN 'first_trade' THEN
        v_should_grant := v_profile.total_trades >= 1;
      WHEN 'trades_10' THEN
        v_should_grant := v_profile.total_trades >= 10;
      WHEN 'trades_50' THEN
        v_should_grant := v_profile.total_trades >= 50;
      WHEN 'trades_100' THEN
        v_should_grant := v_profile.total_trades >= 100;
      WHEN 'trades_500' THEN
        v_should_grant := v_profile.total_trades >= 500;
      
      -- Profit achievements
      WHEN 'profit_100' THEN
        v_should_grant := v_profile.total_profit >= 100;
      WHEN 'profit_500' THEN
        v_should_grant := v_profile.total_profit >= 500;
      WHEN 'profit_1000' THEN
        v_should_grant := v_profile.total_profit >= 1000;
      WHEN 'profit_5000' THEN
        v_should_grant := v_profile.total_profit >= 5000;
      WHEN 'profit_10000' THEN
        v_should_grant := v_profile.total_profit >= 10000;
      
      -- Volume achievements
      WHEN 'volume_1000' THEN
        v_should_grant := v_profile.total_volume >= 1000;
      WHEN 'volume_5000' THEN
        v_should_grant := v_profile.total_volume >= 5000;
      WHEN 'volume_10000' THEN
        v_should_grant := v_profile.total_volume >= 10000;
      WHEN 'volume_50000' THEN
        v_should_grant := v_profile.total_volume >= 50000;
      WHEN 'volume_100000' THEN
        v_should_grant := v_profile.total_volume >= 100000;
      
      -- Streak achievements
      WHEN 'streak_3' THEN
        v_should_grant := v_profile.best_streak >= 3;
      WHEN 'streak_5' THEN
        v_should_grant := v_profile.best_streak >= 5;
      WHEN 'streak_10' THEN
        v_should_grant := v_profile.best_streak >= 10;
      WHEN 'streak_20' THEN
        v_should_grant := v_profile.best_streak >= 20;
      
      -- ROI achievements
      WHEN 'roi_10' THEN
        v_should_grant := v_profile.roi_percent >= 10;
      WHEN 'roi_25' THEN
        v_should_grant := v_profile.roi_percent >= 25;
      WHEN 'roi_50' THEN
        v_should_grant := v_profile.roi_percent >= 50;
      WHEN 'roi_100' THEN
        v_should_grant := v_profile.roi_percent >= 100;
      
      -- Winning rate achievements
      WHEN 'win_rate_60' THEN
        v_should_grant := v_profile.total_trades >= 10 AND (v_profile.winning_trades::numeric / v_profile.total_trades) >= 0.60;
      WHEN 'win_rate_70' THEN
        v_should_grant := v_profile.total_trades >= 20 AND (v_profile.winning_trades::numeric / v_profile.total_trades) >= 0.70;
      WHEN 'win_rate_80' THEN
        v_should_grant := v_profile.total_trades >= 30 AND (v_profile.winning_trades::numeric / v_profile.total_trades) >= 0.80;
      
      -- Special achievements
      WHEN 'prophet_3' THEN
        v_should_grant := v_profile.best_markets_won_streak >= 3;
      WHEN 'prophet_5' THEN
        v_should_grant := v_profile.best_markets_won_streak >= 5;
      WHEN 'prophet_10' THEN
        v_should_grant := v_profile.best_markets_won_streak >= 10;
      WHEN 'night_owl' THEN
        v_should_grant := v_profile.has_night_trade = true;
      WHEN 'early_bird' THEN
        v_should_grant := v_profile.has_early_trade = true;
      WHEN 'weekend_warrior' THEN
        v_should_grant := v_profile.weekend_trades >= 10;
      WHEN 'speed_trader' THEN
        v_should_grant := v_profile.has_speed_trade = true;
      WHEN 'contrarian' THEN
        v_should_grant := v_profile.has_contrarian_trade = true;
      
      -- Referral achievements
      WHEN 'referral_first' THEN
        v_should_grant := v_profile.total_referrals >= 1;
      WHEN 'referral_5' THEN
        v_should_grant := v_profile.total_referrals >= 5;
      WHEN 'referral_10' THEN
        v_should_grant := v_profile.total_referrals >= 10;
      WHEN 'referral_25' THEN
        v_should_grant := v_profile.total_referrals >= 25;
      WHEN 'referral_activated_5' THEN
        v_should_grant := v_profile.activated_referrals >= 5;
      WHEN 'referral_earnings_100' THEN
        v_should_grant := v_profile.total_referral_commission >= 100;
      WHEN 'referral_earnings_500' THEN
        v_should_grant := v_profile.total_referral_commission >= 500;
      WHEN 'referral_earnings_1000' THEN
        v_should_grant := v_profile.total_referral_commission >= 1000;
      
      -- Suggestion achievements
      WHEN 'suggestion_first' THEN
        v_should_grant := v_suggestions_created >= 1;
      WHEN 'suggestion_5' THEN
        v_should_grant := v_suggestions_created >= 5;
      WHEN 'suggestion_approved' THEN
        v_should_grant := v_suggestions_approved >= 1;
      WHEN 'suggestion_implemented' THEN
        v_should_grant := v_suggestions_implemented >= 1;
      WHEN 'suggestion_popular' THEN
        v_should_grant := v_best_suggestion_score >= 50;
      
      ELSE
        v_should_grant := false;
    END CASE;
    
    -- Conceder conquista se aplicável
    IF v_should_grant THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_achievement.id)
      ON CONFLICT DO NOTHING;
      
      -- Criar notificação
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        p_user_id,
        'ACHIEVEMENT',
        'Nova Conquista!',
        'Você desbloqueou: ' || v_achievement.name,
        jsonb_build_object(
          'achievement_id', v_achievement.id,
          'achievement_code', v_achievement.code,
          'achievement_name', v_achievement.name,
          'points', v_achievement.points
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Trigger para verificar conquistas ao criar sugestão
CREATE OR REPLACE FUNCTION public.check_suggestion_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar conquistas do autor
  PERFORM check_and_grant_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_suggestion_achievements
AFTER INSERT OR UPDATE ON public.market_suggestions
FOR EACH ROW EXECUTE FUNCTION public.check_suggestion_achievements();