-- Remover policy insegura/conflitante
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Remover policy existente de admin para recriar corretamente
DROP POLICY IF EXISTS "Admins can create notifications for any user" ON public.notifications;

-- Policy: usuários comuns só criam notificações para si mesmos
CREATE POLICY "Users can create own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: admins podem criar notificações para qualquer usuário
CREATE POLICY "Admins can create notifications for any user"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));