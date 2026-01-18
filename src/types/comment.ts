export interface Comment {
  id: string;
  marketId: string;
  userId: string;
  parentId?: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
  likesCount: number;
  repliesCount: number;
  isLikedByUser?: boolean;
  isHidden?: boolean;
  replies?: Comment[];
  replyingToName?: string;
  mentions: string[];
}

export interface CommentReport {
  id: string;
  commentId: string;
  reporterId: string;
  reason: 'spam' | 'offensive' | 'misinformation' | 'other';
  description?: string;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED';
  reviewedBy?: string;
  reviewedAt?: Date;
  actionTaken?: 'none' | 'hidden' | 'deleted' | 'user_warned';
  createdAt: Date;
  // Joined data
  comment?: Comment;
  reporterName?: string;
  commentAuthorName?: string;
  marketTitle?: string;
  suggestionTitle?: string;
  // Source type
  source: 'market' | 'suggestion';
  suggestionId?: string;
}

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam', description: 'Conteúdo promocional ou repetitivo' },
  { value: 'offensive', label: 'Conteúdo ofensivo', description: 'Linguagem abusiva, ataques pessoais' },
  { value: 'misinformation', label: 'Desinformação', description: 'Informações falsas ou enganosas' },
  { value: 'other', label: 'Outro', description: 'Outro motivo não listado' },
] as const;
