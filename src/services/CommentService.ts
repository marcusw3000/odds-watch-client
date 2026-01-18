import { supabase } from '@/integrations/supabase/client';
import { Comment, CommentReport } from '@/types/comment';
import { 
  notifyCommentMention, 
  notifyCommentLike, 
  notifyCommentReply,
  notifyUserWarning
} from './NotificationService';

interface MentionUser {
  user_id: string;
  display_name: string;
}

export const CommentService = {
  // Search users for mention autocomplete - NOW USING EDGE FUNCTION
  async searchUsersForMention(query: string): Promise<MentionUser[]> {
    if (!query || query.length < 2) return [];

    try {
      const { data, error } = await supabase.functions.invoke('search-users-mention', {
        body: { q: query }
      });

      if (error) {
        console.error('Error searching users via Edge Function:', error);
        return [];
      }

      return data?.users || [];
    } catch (err) {
      console.error('Error invoking search-users-mention:', err);
      return [];
    }
  },

  // Get display info for a user via Edge Function
  async getUserDisplayInfo(userId: string): Promise<{ displayName: string; avatarUrl?: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke(
        `get-user-display-info?user_id=${encodeURIComponent(userId)}`
      );

      if (error || !data) {
        return null;
      }

      return {
        displayName: data.display_name || data.displayName || 'Usuário',
        avatarUrl: data.avatar_url || data.avatarUrl
      };
    } catch (err) {
      console.error('Error fetching user display info:', err);
      return null;
    }
  },

  // Get root comments (no parent)
  async getRootComments(marketId: string, currentUserId?: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (avatar_url)
      `)
      .eq('market_id', marketId)
      .is('parent_id', null)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching comments:', error);
      return [];
    }

    // Get user likes if logged in
    let userLikes: Set<string> = new Set();
    if (currentUserId) {
      const { data: likes } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', currentUserId);
      
      if (likes) {
        userLikes = new Set(likes.map(l => l.comment_id));
      }
    }

    // Get display names for authors via Edge Function (batch call)
    const userIds = [...new Set((data || []).map(c => c.user_id))];
    const displayInfoMap = new Map<string, { displayName: string; avatarUrl?: string }>();
    
    // Fetch display info for all unique users
    await Promise.all(
      userIds.map(async (userId) => {
        const info = await this.getUserDisplayInfo(userId);
        if (info) {
          displayInfoMap.set(userId, info);
        }
      })
    );

    return (data || []).map(comment => ({
      id: comment.id,
      marketId: comment.market_id,
      userId: comment.user_id,
      parentId: comment.parent_id || undefined,
      authorName: displayInfoMap.get(comment.user_id)?.displayName || 'Usuário',
      authorAvatar: displayInfoMap.get(comment.user_id)?.avatarUrl || 
        (comment.profiles as any)?.avatar_url || undefined,
      content: comment.content,
      createdAt: new Date(comment.created_at),
      likesCount: comment.likes_count,
      repliesCount: comment.replies_count,
      isLikedByUser: userLikes.has(comment.id),
      isHidden: comment.is_hidden,
      mentions: comment.mentions || [],
    }));
  },

  // Get replies for a comment
  async getReplies(parentId: string, currentUserId?: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (avatar_url),
        parent:parent_id (
          user_id
        )
      `)
      .eq('parent_id', parentId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching replies:', error);
      return [];
    }

    // Get user likes if logged in
    let userLikes: Set<string> = new Set();
    if (currentUserId) {
      const commentIds = (data || []).map(c => c.id);
      const { data: likes } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', currentUserId)
        .in('comment_id', commentIds);
      
      if (likes) {
        userLikes = new Set(likes.map(l => l.comment_id));
      }
    }

    // Get display names via Edge Function
    const userIds = [...new Set((data || []).map(c => c.user_id))];
    const parentUserIds = [...new Set((data || []).map(c => (c.parent as any)?.user_id).filter(Boolean))];
    const allUserIds = [...new Set([...userIds, ...parentUserIds])];
    
    const displayInfoMap = new Map<string, { displayName: string; avatarUrl?: string }>();
    
    await Promise.all(
      allUserIds.map(async (userId) => {
        const info = await this.getUserDisplayInfo(userId);
        if (info) {
          displayInfoMap.set(userId, info);
        }
      })
    );

    return (data || []).map(comment => {
      const parentUserId = (comment.parent as any)?.user_id;
      
      return {
        id: comment.id,
        marketId: comment.market_id,
        userId: comment.user_id,
        parentId: comment.parent_id || undefined,
        authorName: displayInfoMap.get(comment.user_id)?.displayName || 'Usuário',
        authorAvatar: displayInfoMap.get(comment.user_id)?.avatarUrl || 
          (comment.profiles as any)?.avatar_url || undefined,
        content: comment.content,
        createdAt: new Date(comment.created_at),
        likesCount: comment.likes_count,
        repliesCount: comment.replies_count,
        isLikedByUser: userLikes.has(comment.id),
        isHidden: comment.is_hidden,
        mentions: comment.mentions || [],
        replyingToName: parentUserId ? 
          (displayInfoMap.get(parentUserId)?.displayName || 'Usuário') : 
          undefined,
      };
    });
  },

  // Create a new comment
  async createComment(
    marketId: string, 
    content: string, 
    mentions: string[] = [],
    parentId?: string
  ): Promise<Comment | null> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Usuário não autenticado');
    }

    const userId = userData.user.id;

    // Insert comment
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        market_id: marketId,
        user_id: userId,
        parent_id: parentId || null,
        content,
        mentions,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      throw new Error('Erro ao criar comentário');
    }

    // Get author info via Edge Function
    const authorInfo = await this.getUserDisplayInfo(userId);
    const authorName = authorInfo?.displayName || 'Usuário';
    const authorAvatar = authorInfo?.avatarUrl;

    // Get market title for notifications
    const { data: market } = await supabase
      .from('markets')
      .select('title')
      .eq('id', marketId)
      .single();

    const marketTitle = market?.title || 'Mercado';

    // If this is a reply, increment parent's replies_count and notify
    if (parentId) {
      await supabase.rpc('increment_replies_count', { p_comment_id: parentId });

      // Get parent comment author
      const { data: parentComment } = await supabase
        .from('comments')
        .select('user_id')
        .eq('id', parentId)
        .single();

      if (parentComment && parentComment.user_id !== userId) {
        await notifyCommentReply(
          parentComment.user_id,
          authorName,
          marketId,
          marketTitle,
          content.slice(0, 50)
        );
      }
    }

    // Notify mentioned users
    for (const mentionedUserId of mentions) {
      if (mentionedUserId !== userId) {
        await notifyCommentMention(
          mentionedUserId,
          authorName,
          marketId,
          marketTitle,
          content.slice(0, 50)
        );
      }
    }

    return {
      id: comment.id,
      marketId: comment.market_id,
      userId: comment.user_id,
      parentId: comment.parent_id || undefined,
      authorName,
      authorAvatar: authorAvatar || undefined,
      content: comment.content,
      createdAt: new Date(comment.created_at),
      likesCount: 0,
      repliesCount: 0,
      isLikedByUser: false,
      isHidden: false,
      mentions: comment.mentions || [],
    };
  },

  // Like a comment
  async likeComment(commentId: string): Promise<boolean> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Usuário não autenticado');
    }

    const userId = userData.user.id;

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .single();

    if (existingLike) {
      // Unlike
      await supabase
        .from('comment_likes')
        .delete()
        .eq('id', existingLike.id);

      await supabase.rpc('decrement_comment_likes', { p_comment_id: commentId });
      return false;
    } else {
      // Like
      const { error } = await supabase
        .from('comment_likes')
        .insert({
          comment_id: commentId,
          user_id: userId,
        });

      if (error) {
        console.error('Error liking comment:', error);
        throw new Error('Erro ao curtir comentário');
      }

      await supabase.rpc('increment_comment_likes', { p_comment_id: commentId });

      // Get comment and notify author
      const { data: comment } = await supabase
        .from('comments')
        .select('user_id, content, market_id, likes_count')
        .eq('id', commentId)
        .single();

      if (comment && comment.user_id !== userId) {
        // Get liker name via Edge Function
        const likerInfo = await this.getUserDisplayInfo(userId);
        const likerName = likerInfo?.displayName || 'Usuário';

        // Get market title
        const { data: market } = await supabase
          .from('markets')
          .select('title')
          .eq('id', comment.market_id)
          .single();

        await notifyCommentLike(
          comment.user_id,
          likerName,
          comment.market_id,
          market?.title || 'Mercado',
          comment.likes_count + 1
        );
      }

      return true;
    }
  },

  // Report a comment
  async reportComment(
    commentId: string, 
    reason: 'spam' | 'offensive' | 'misinformation' | 'other',
    description?: string
  ): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Usuário não autenticado');
    }

    const { error } = await supabase
      .from('comment_reports')
      .insert({
        comment_id: commentId,
        reporter_id: userData.user.id,
        reason,
        description,
      });

    if (error) {
      console.error('Error reporting comment:', error);
      throw new Error('Erro ao denunciar comentário');
    }
  },

  // Delete own comment
  async deleteComment(commentId: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Usuário não autenticado');
    }

    // Get comment to check ownership and parent
    const { data: comment } = await supabase
      .from('comments')
      .select('user_id, parent_id')
      .eq('id', commentId)
      .single();

    if (!comment || comment.user_id !== userData.user.id) {
      throw new Error('Você não pode excluir este comentário');
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      throw new Error('Erro ao excluir comentário');
    }

    // Decrement parent's replies_count if this was a reply
    if (comment.parent_id) {
      await supabase.rpc('decrement_replies_count', { p_comment_id: comment.parent_id });
    }
  },

  // Admin: Get all reports (from both market comments and suggestion comments)
  async getReports(status?: string, reason?: string): Promise<CommentReport[]> {
    // Fetch from market comment_reports
    let marketQuery = supabase
      .from('comment_reports')
      .select(`
        *,
        comments:comment_id (
          id,
          content,
          user_id,
          market_id,
          markets:market_id (title)
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      marketQuery = marketQuery.eq('status', status);
    }
    if (reason) {
      marketQuery = marketQuery.eq('reason', reason);
    }

    // Fetch from suggestion_comment_reports
    let suggestionQuery = supabase
      .from('suggestion_comment_reports')
      .select(`
        *,
        suggestion_comments:comment_id (
          id,
          content,
          user_id,
          suggestion_id,
          suggestions:suggestion_id (title)
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      suggestionQuery = suggestionQuery.eq('status', status);
    }
    if (reason) {
      suggestionQuery = suggestionQuery.eq('reason', reason);
    }

    const [marketResult, suggestionResult] = await Promise.all([
      marketQuery,
      suggestionQuery
    ]);

    if (marketResult.error) {
      console.error('Error fetching market reports:', marketResult.error);
    }
    if (suggestionResult.error) {
      console.error('Error fetching suggestion reports:', suggestionResult.error);
    }

    const marketData = marketResult.data || [];
    const suggestionData = suggestionResult.data || [];

    // Collect all unique user IDs for display info
    const marketReporterIds = marketData.map(r => r.reporter_id);
    const marketAuthorIds = marketData.map(r => (r.comments as any)?.user_id).filter(Boolean);
    const suggestionReporterIds = suggestionData.map(r => r.reporter_id);
    const suggestionAuthorIds = suggestionData.map(r => (r.suggestion_comments as any)?.user_id).filter(Boolean);
    
    const allUserIds = [...new Set([
      ...marketReporterIds, 
      ...marketAuthorIds, 
      ...suggestionReporterIds, 
      ...suggestionAuthorIds
    ])];

    const displayInfoMap = new Map<string, string>();
    
    await Promise.all(
      allUserIds.map(async (userId) => {
        const info = await this.getUserDisplayInfo(userId);
        if (info) {
          displayInfoMap.set(userId, info.displayName);
        }
      })
    );

    const getName = (userId: string) => {
      return displayInfoMap.get(userId) || 'Usuário';
    };

    // Map market reports
    const marketReports: CommentReport[] = marketData.map(report => ({
      id: report.id,
      commentId: report.comment_id,
      reporterId: report.reporter_id,
      reason: report.reason as CommentReport['reason'],
      description: report.description || undefined,
      status: report.status as CommentReport['status'],
      reviewedBy: report.reviewed_by || undefined,
      reviewedAt: report.reviewed_at ? new Date(report.reviewed_at) : undefined,
      actionTaken: report.action_taken as CommentReport['actionTaken'],
      createdAt: new Date(report.created_at),
      reporterName: getName(report.reporter_id),
      commentAuthorName: (report.comments as any)?.user_id ? getName((report.comments as any).user_id) : undefined,
      marketTitle: (report.comments as any)?.markets?.title,
      source: 'market' as const,
      comment: (report.comments as any) ? {
        id: (report.comments as any).id,
        content: (report.comments as any).content,
        userId: (report.comments as any).user_id,
        marketId: (report.comments as any).market_id,
      } as any : undefined,
    }));

    // Map suggestion reports
    const suggestionReports: CommentReport[] = suggestionData.map(report => ({
      id: report.id,
      commentId: report.comment_id,
      reporterId: report.reporter_id,
      reason: report.reason as CommentReport['reason'],
      description: report.description || undefined,
      status: report.status as CommentReport['status'],
      reviewedBy: report.reviewed_by || undefined,
      reviewedAt: report.reviewed_at ? new Date(report.reviewed_at) : undefined,
      actionTaken: report.action_taken as CommentReport['actionTaken'],
      createdAt: new Date(report.created_at),
      reporterName: getName(report.reporter_id),
      commentAuthorName: (report.suggestion_comments as any)?.user_id ? getName((report.suggestion_comments as any).user_id) : undefined,
      suggestionTitle: (report.suggestion_comments as any)?.suggestions?.title,
      suggestionId: (report.suggestion_comments as any)?.suggestion_id,
      source: 'suggestion' as const,
      comment: (report.suggestion_comments as any) ? {
        id: (report.suggestion_comments as any).id,
        content: (report.suggestion_comments as any).content,
        userId: (report.suggestion_comments as any).user_id,
        marketId: undefined,
      } as any : undefined,
    }));

    // Combine and sort by created_at desc
    const allReports = [...marketReports, ...suggestionReports];
    allReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return allReports;
  },

  // Admin: Update report status
  async updateReportStatus(
    reportId: string, 
    status: CommentReport['status'],
    actionTaken?: CommentReport['actionTaken'],
    source: 'market' | 'suggestion' = 'market'
  ): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Usuário não autenticado');
    }

    const updateData: any = {
      status,
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (actionTaken) {
      updateData.action_taken = actionTaken;
    }

    const tableName = source === 'suggestion' ? 'suggestion_comment_reports' : 'comment_reports';
    const commentsTable = source === 'suggestion' ? 'suggestion_comments' : 'comments';

    const { error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', reportId);

    if (error) {
      console.error('Error updating report:', error);
      throw new Error('Erro ao atualizar denúncia');
    }

    // If action is to hide or delete the comment
    if (actionTaken === 'hidden' || actionTaken === 'deleted') {
      const { data: report } = await supabase
        .from(tableName)
        .select('comment_id')
        .eq('id', reportId)
        .single();

      if (report) {
        if (actionTaken === 'hidden') {
          await supabase
            .from(commentsTable)
            .update({ is_hidden: true })
            .eq('id', report.comment_id);
        } else if (actionTaken === 'deleted') {
          await supabase
            .from(commentsTable)
            .delete()
            .eq('id', report.comment_id);
        }
      }
    }

    // If action is to warn the user, send a notification
    if (actionTaken === 'user_warned') {
      console.log('[CommentService] Processing user_warned action for report:', reportId);
      
      try {
        const { data: report, error: reportError } = await supabase
          .from(tableName)
          .select('comment_id, reason')
          .eq('id', reportId)
          .single();

        if (reportError) {
          console.error('[CommentService] Error fetching report:', reportError);
          return;
        }

        if (!report) {
          console.error('[CommentService] Report not found:', reportId);
          return;
        }

        console.log('[CommentService] Found report:', report);

        const { data: comment, error: commentError } = await supabase
          .from(commentsTable)
          .select('user_id, content')
          .eq('id', report.comment_id)
          .single();

        if (commentError) {
          console.error('[CommentService] Error fetching comment:', commentError);
          return;
        }

        if (!comment) {
          console.error('[CommentService] Comment not found:', report.comment_id);
          return;
        }

        console.log('[CommentService] Found comment, notifying user:', comment.user_id);

        // Use static import for reliability
        await notifyUserWarning(
          comment.user_id,
          report.reason,
          comment.content.slice(0, 50),
          source
        );

        console.log('[CommentService] User warning notification sent successfully');
      } catch (error) {
        console.error('[CommentService] Error sending user warning notification:', error);
      }
    }
  },

  // Admin: Get pending reports count (from both tables)
  async getPendingReportsCount(): Promise<number> {
    const [marketCount, suggestionCount] = await Promise.all([
      supabase
        .from('comment_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      supabase
        .from('suggestion_comment_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING')
    ]);

    if (marketCount.error) {
      console.error('Error fetching market pending reports count:', marketCount.error);
    }
    if (suggestionCount.error) {
      console.error('Error fetching suggestion pending reports count:', suggestionCount.error);
    }

    return (marketCount.count || 0) + (suggestionCount.count || 0);
  },
};
