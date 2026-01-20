-- Adicionar tipos de notificação de suporte que estão faltando
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'SUPPORT_REPLY';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_RESOLVED';

-- Adicionar coluna mentions para suggestion_comments (paridade com comments)
ALTER TABLE suggestion_comments 
ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';

-- Criar índice GIN para buscas eficientes
CREATE INDEX IF NOT EXISTS idx_suggestion_comments_mentions 
ON suggestion_comments USING GIN (mentions);