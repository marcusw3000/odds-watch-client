export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';

export interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  status: SuggestionStatus;
  score: number;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  admin_notes?: string;
  market_id?: string;
  // Joined fields from get_trending_suggestions
  author_name?: string;
  author_avatar?: string;
  user_vote?: number | null;
}

export interface SuggestionComment {
  id: string;
  suggestion_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  likes_count: number;
  replies_count: number;
  created_at: string;
  updated_at: string;
  is_hidden: boolean;
  // Joined fields
  author_name?: string;
  author_avatar?: string;
  user_liked?: boolean;
}

export interface SuggestionVote {
  id: string;
  suggestion_id: string;
  user_id: string;
  vote_value: number;
  created_at: string;
}

export interface VoteResult {
  success: boolean;
  upvotes: number;
  downvotes: number;
  score: number;
  user_vote: number | null;
}

export interface CreateSuggestionData {
  title: string;
  description: string;
  category: string;
}

export interface ReviewSuggestionData {
  status: 'APPROVED' | 'REJECTED';
  admin_notes?: string;
}

export type SuggestionSortOption = 'trending' | 'recent' | 'most_voted' | 'most_commented';
export type SuggestionFilterOption = 'all' | 'pending' | 'approved' | 'implemented' | 'mine';
