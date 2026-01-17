-- Add new notification types for suggestion comments
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'SUGGESTION_COMMENT_MENTION';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'SUGGESTION_COMMENT_REPLY';