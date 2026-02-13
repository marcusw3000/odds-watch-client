
-- 1. Revogar permissões de escrita de anon e authenticated
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

-- 2. Garantir que SELECT permanece (para has_role funcionar)
GRANT SELECT ON public.user_roles TO anon, authenticated;

-- 3. Recriar política RLS com WITH CHECK explícito e TO authenticated
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
