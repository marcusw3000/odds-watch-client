-- Adicionar novos tipos de notificação para admin
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ADMIN_NEW_TICKET';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ADMIN_NEW_REPORT';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ADMIN_NEW_CONTESTATION';