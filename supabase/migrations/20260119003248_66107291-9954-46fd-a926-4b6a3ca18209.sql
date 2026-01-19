-- Remove a política restritiva que só permite ver próprio perfil
DROP POLICY IF EXISTS "Users can only view own profile" ON public.profiles;

-- Nova política: pode ver próprio perfil OU perfis públicos
CREATE POLICY "Users can view own profile or public profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id  -- Próprio perfil
  OR is_public = true  -- Perfis marcados como públicos
);