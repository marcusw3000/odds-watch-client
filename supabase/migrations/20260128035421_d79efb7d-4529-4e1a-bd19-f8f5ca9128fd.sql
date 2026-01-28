-- Permitir NULL para suportar ON DELETE SET NULL
ALTER TABLE admin_audit_logs 
ALTER COLUMN actor_user_id DROP NOT NULL;

-- Adicionar FK para profiles
ALTER TABLE admin_audit_logs
ADD CONSTRAINT admin_audit_logs_actor_user_id_fkey
FOREIGN KEY (actor_user_id) REFERENCES profiles(id) ON DELETE SET NULL;