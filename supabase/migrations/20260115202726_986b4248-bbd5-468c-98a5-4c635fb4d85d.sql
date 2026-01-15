-- =====================================================
-- FASE 2 (FINAL): Completar consolidação de perfis
-- =====================================================

-- 1. Dropar tabelas antigas
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.user_statistics CASCADE;
DROP TABLE IF EXISTS public.leaderboard_profiles CASCADE;

-- 2. Recriar user_achievements com FK para achievements
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS em user_achievements
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- 4. Criar policies para user_achievements
CREATE POLICY "User achievements visible if profile public"
ON public.user_achievements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_achievements.user_id
    AND (p.is_public = true OR p.id = auth.uid())
  )
);

CREATE POLICY "System can grant achievements"
ON public.user_achievements
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Atualizar view wallets_with_profile
DROP VIEW IF EXISTS public.wallets_with_profile;
CREATE VIEW public.wallets_with_profile AS
SELECT 
  w.id,
  w.user_id,
  w.balance_available,
  w.balance_locked,
  w.total_deposited,
  w.total_withdrawn,
  w.currency,
  w.created_at,
  w.updated_at,
  p.email,
  p.full_name,
  p.display_name
FROM public.wallets w
LEFT JOIN public.profiles p ON w.user_id = p.id;