import { supabase } from '@/integrations/supabase/client';
import { 
  notifySuggestionCommentMention, 
  notifySuggestionCommentReply 
} from './NotificationService';
import type { 
  Suggestion, 
  SuggestionComment, 
  VoteResult, 
  CreateSuggestionData,
  ReviewSuggestionData,
  SuggestionSortOption,
  SuggestionFilterOption 
} from '@/types/suggestion';

export const SuggestionService = {
  /**
   * Get suggestions with filters and sorting
   */
  async getSuggestions(
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      category?: string;
      sort?: SuggestionSortOption;
      filter?: SuggestionFilterOption;
    } = {}
  ): Promise<Suggestion[]> {
    const { limit = 20, offset = 0, status, category, sort = 'trending', filter } = options;

    // Use the RPC function for trending with author info
    const { data, error } = await supabase.rpc('get_trending_suggestions', {
      p_limit: limit,
      p_offset: offset,
      p_status: filter === 'pending' ? 'PENDING' : 
                filter === 'approved' ? 'APPROVED' : 
                filter === 'implemented' ? 'IMPLEMENTED' : 
                status || null,
      p_category: category || null
    });

    if (error) {
      console.error('Error fetching suggestions:', error);
      throw error;
    }

    // Sort based on option
    let sorted = data || [];
    if (sort === 'recent') {
      sorted = [...sorted].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sort === 'most_commented') {
      sorted = [...sorted].sort((a, b) => b.comment_count - a.comment_count);
    }

    return sorted as Suggestion[];
  },

  /**
   * Get user's own suggestions
   */
  async getMySuggestions(userId: string): Promise<Suggestion[]> {
    const { data, error } = await supabase
      .from('market_suggestions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Suggestion[];
  },

  /**
   * Get a single suggestion by ID
   */
  async getSuggestionById(id: string): Promise<Suggestion | null> {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('market_suggestions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    // Get author info
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, full_name, avatar_url')
      .eq('id', data.user_id)
      .single();

    // Get user vote if logged in
    let userVote = null;
    if (user?.user) {
      const { data: voteData } = await supabase
        .from('suggestion_votes')
        .select('vote_value')
        .eq('suggestion_id', id)
        .eq('user_id', user.user.id)
        .single();
      
      userVote = voteData?.vote_value || null;
    }

    return {
      ...data,
      author_name: profile?.display_name || profile?.full_name || 'Usuário',
      author_avatar: profile?.avatar_url,
      user_vote: userVote
    } as Suggestion;
  },

  /**
   * Create a new suggestion
   */
  async createSuggestion(data: CreateSuggestionData): Promise<Suggestion> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('Not authenticated');

    const { data: suggestion, error } = await supabase
      .from('market_suggestions')
      .insert({
        user_id: user.user.id,
        title: data.title,
        description: data.description,
        category: data.category
      })
      .select()
      .single();

    if (error) throw error;
    return suggestion as Suggestion;
  },

  /**
   * Update a suggestion (only if PENDING and owner)
   */
  async updateSuggestion(id: string, data: Partial<CreateSuggestionData>): Promise<Suggestion> {
    const { data: suggestion, error } = await supabase
      .from('market_suggestions')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return suggestion as Suggestion;
  },

  /**
   * Delete a suggestion (only if PENDING and owner)
   */
  async deleteSuggestion(id: string): Promise<void> {
    const { error } = await supabase
      .from('market_suggestions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Vote on a suggestion
   */
  async vote(suggestionId: string, voteValue: number): Promise<VoteResult> {
    const { data, error } = await supabase.rpc('vote_on_suggestion', {
      p_suggestion_id: suggestionId,
      p_vote_value: voteValue
    });

    if (error) throw error;
    return data as unknown as VoteResult;
  },

  /**
   * Get comments for a suggestion
   */
  async getComments(suggestionId: string, parentId?: string): Promise<SuggestionComment[]> {
    const { data: user } = await supabase.auth.getUser();
    
    let query = supabase
      .from('suggestion_comments')
      .select('*')
      .eq('suggestion_id', suggestionId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.is('parent_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get author info for each comment
    const userIds = [...new Set((data || []).map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, full_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p])
    );

    // Get user likes if logged in
    let userLikes = new Set<string>();
    if (user?.user) {
      const { data: likes } = await supabase
        .from('suggestion_comment_likes')
        .select('comment_id')
        .eq('user_id', user.user.id)
        .in('comment_id', (data || []).map(c => c.id));
      
      userLikes = new Set((likes || []).map(l => l.comment_id));
    }

    return (data || []).map(comment => {
      const profile = profileMap.get(comment.user_id);
      return {
        ...comment,
        author_name: profile?.display_name || profile?.full_name || 'Usuário',
        author_avatar: profile?.avatar_url,
        user_liked: userLikes.has(comment.id)
      };
    }) as SuggestionComment[];
  },

  /**
   * Add a comment to a suggestion
   */
  async addComment(
    suggestionId: string, 
    content: string, 
    parentId?: string,
    mentionedUserIds?: string[],
    suggestionTitle?: string
  ): Promise<SuggestionComment> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('suggestion_comments')
      .insert({
        suggestion_id: suggestionId,
        user_id: user.user.id,
        content,
        parent_id: parentId || null,
        mentions: mentionedUserIds || []
      })
      .select()
      .single();

    if (error) throw error;

    // Get author name for notifications
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, full_name')
      .eq('id', user.user.id)
      .single();
    
    const authorName = profile?.display_name || profile?.full_name || 'Alguém';
    const commentPreview = content.substring(0, 50);
    const title = suggestionTitle || 'uma sugestão';

    // Send mention notifications
    if (mentionedUserIds && mentionedUserIds.length > 0) {
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId !== user.user.id) {
          await notifySuggestionCommentMention(
            mentionedUserId,
            authorName,
            suggestionId,
            title,
            commentPreview
          );
        }
      }
    }

    // Send reply notification to parent comment author
    if (parentId) {
      const { data: parentComment } = await supabase
        .from('suggestion_comments')
        .select('user_id')
        .eq('id', parentId)
        .single();
      
      if (parentComment && parentComment.user_id !== user.user.id) {
        await notifySuggestionCommentReply(
          parentComment.user_id,
          authorName,
          suggestionId,
          title,
          commentPreview
        );
      }
    }

    return data as SuggestionComment;
  },

  /**
   * Like/unlike a comment
   */
  async toggleCommentLike(commentId: string): Promise<boolean> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('Not authenticated');

    // Check if already liked
    const { data: existing } = await supabase
      .from('suggestion_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.user.id)
      .single();

    if (existing) {
      // Unlike
      await supabase
        .from('suggestion_comment_likes')
        .delete()
        .eq('id', existing.id);
      return false;
    } else {
      // Like
      await supabase
        .from('suggestion_comment_likes')
        .insert({
          comment_id: commentId,
          user_id: user.user.id
        });
      return true;
    }
  },

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('suggestion_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  },

  /**
   * Report a comment
   */
  async reportComment(
    commentId: string,
    reason: 'spam' | 'offensive' | 'misinformation' | 'other',
    description?: string
  ): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('suggestion_comment_reports' as any)
      .insert({
        comment_id: commentId,
        reporter_id: user.user.id,
        reason,
        description
      });

    if (error) throw error;
  },

  // ============ Admin Functions ============

  /**
   * Get all suggestions for admin (including rejected)
   */
  async getAdminSuggestions(options: {
    limit?: number;
    offset?: number;
    status?: string;
  } = {}): Promise<Suggestion[]> {
    const { limit = 50, offset = 0, status } = options;

    let query = supabase
      .from('market_suggestions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get author info
    const userIds = [...new Set((data || []).map(s => s.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, full_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p])
    );

    return (data || []).map(suggestion => {
      const profile = profileMap.get(suggestion.user_id);
      return {
        ...suggestion,
        author_name: profile?.display_name || profile?.full_name || 'Usuário',
        author_avatar: profile?.avatar_url
      };
    }) as Suggestion[];
  },

  /**
   * Review a suggestion (admin only)
   */
  async reviewSuggestion(id: string, review: ReviewSuggestionData): Promise<Suggestion> {
    const { data, error } = await supabase.functions.invoke('manage-market-suggestions', {
      method: 'POST',
      body: {
        action: 'review',
        suggestionId: id,
        review,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.suggestion as Suggestion;
  },

  /**
   * Implement a suggestion (link to market)
   */
  async implementSuggestion(id: string, marketId: string): Promise<Suggestion> {
    const { data, error } = await supabase.functions.invoke('manage-market-suggestions', {
      method: 'POST',
      body: {
        action: 'implement',
        suggestionId: id,
        marketId,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.suggestion as Suggestion;
  },

  /**
   * Get suggestion categories
   */
  getCategories(): { value: string; label: string }[] {
    return [
      { value: 'economia', label: 'Economia' },
      { value: 'politica', label: 'Política' },
      { value: 'esportes', label: 'Esportes' },
      { value: 'entretenimento', label: 'Entretenimento' },
      { value: 'tecnologia', label: 'Tecnologia' },
      { value: 'ciencia', label: 'Ciência' },
      { value: 'cultura', label: 'Cultura' },
      { value: 'geral', label: 'Geral' }
    ];
  }
};
