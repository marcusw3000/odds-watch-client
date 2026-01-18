-- Permitir que admins criem notificações para qualquer usuário
CREATE POLICY "Admins can create notifications for any user"
ON notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));