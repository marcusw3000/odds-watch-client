import { supabase } from '@/integrations/supabase/client';
import { Comment, CommentReport } from '@/types/comment';
import { 
  notifyCommentMention, 
  notifyCommentLike, 
  notifyCommentReply 
} from './NotificationService';

interface MentionUser {
  user_id: string;
  display_name: string;
}

export const CommentService = {
  // Search users for mention autocomplete
  async searchUsersForMention(query: string): Promise<MentionUser[]> {
    if (!query || query.length < 2) return [];

    const { data, error } = await supabase
      .from('leaderboard_profiles')
      .select('user_id, display_name')
      .eq('is_public', true)
      .ilike('display_name', `%${query}%`)
      .limit(5);

    if (error) {
      console.error('Error searching users:', error);
      return [];
    }

    return data || [];
  },

  // Get root comments (no parent)
  async getRootComments(marketId: string, currentUserId?: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (full_name, avatar_url)
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

    // Get display names for authors
    const userIds = [...new Set((data || []).map(c => c.user_id))];
    const { data: leaderboardProfiles } = await supabase
      .from('leaderboard_profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);

    const displayNameMap = new Map(
      (leaderboardProfiles || []).map(p => [p.user_id, p.display_name])
    );

    return (data || []).map(comment => ({
      id: comment.id,
      marketId: comment.market_id,
      userId: comment.user_id,
      parentId: comment.parent_id || undefined,
      authorName: displayNameMap.get(comment.user_id) || 
        (comment.profiles as any)?.full_name || 
        'Usuário',
      authorAvatar: (comment.profiles as any)?.avatar_url || undefined,
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
        profiles:user_id (full_name, avatar_url),
        parent:parent_id (
          user_id,
          profiles:user_id (full_name)
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

    // Get display names
    const userIds = [...new Set((data || []).map(c => c.user_id))];
    const parentUserIds = [...new Set((data || []).map(c => (c.parent as any)?.user_id).filter(Boolean))];
    const allUserIds = [...new Set([...userIds, ...parentUserIds])];
    
    const { data: leaderboardProfiles } = await supabase
      .from('leaderboard_profiles')
      .select('user_id, display_name')
      .in('user_id', allUserIds);

    const displayNameMap = new Map(
      (leaderboardProfiles || []).map(p => [p.user_id, p.display_name])
    );

    return (data || []).map(comment => {
      const parentUserId = (comment.parent as any)?.user_id;
      const parentProfile = (comment.parent as any)?.profiles;
      
      return {
        id: comment.id,
        marketId: comment.market_id,
        userId: comment.user_id,
        parentId: comment.parent_id || undefined,
        authorName: displayNameMap.get(comment.user_id) || 
          (comment.profiles as any)?.full_name || 
          'Usuário',
        authorAvatar: (comment.profiles as any)?.avatar_url || undefined,
        content: comment.content,
        createdAt: new Date(comment.created_at),
        likesCount: comment.likes_count,
        repliesCount: comment.replies_count,
        isLikedByUser: userLikes.has(comment.id),
        isHidden: comment.is_hidden,
        mentions: comment.mentions || [],
        replyingToName: parentUserId ? 
          (displayNameMap.get(parentUserId) || parentProfile?.full_name || 'Usuário') : 
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

    // Get author info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .single();

    const { data: leaderboardProfile } = await supabase
      .from('leaderboard_profiles')
      .select('display_name')
      .eq('user_id', userId)
      .single();

    const authorName = leaderboardProfile?.display_name || profile?.full_name || 'Usuário';

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
      authorAvatar: profile?.avatar_url || undefined,
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
        // Get liker name
        const { data: likerProfile } = await supabase
          .from('leaderboard_profiles')
          .select('display_name')
          .eq('user_id', userId)
          .single();

        const { data: likerBasicProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();

        const likerName = likerProfile?.display_name || likerBasicProfile?.full_name || 'Usuário';

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

  // Admin: Get all reports
  async getReports(status?: string): Promise<CommentReport[]> {
    let query = supabase
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
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reports:', error);
      return [];
    }

    // Get reporter and author names
    const reporterIds = [...new Set((data || []).map(r => r.reporter_id))];
    const authorIds = [...new Set((data || []).map(r => (r.comments as any)?.user_id).filter(Boolean))];
    const allUserIds = [...new Set([...reporterIds, ...authorIds])];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', allUserIds);

    const { data: leaderboardProfiles } = await supabase
      .from('leaderboard_profiles')
      .select('user_id, display_name')
      .in('user_id', allUserIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
    const displayNameMap = new Map((leaderboardProfiles || []).map(p => [p.user_id, p.display_name]));

    const getName = (userId: string) => displayNameMap.get(userId) || profileMap.get(userId) || 'Usuário';

    return (data || []).map(report => ({
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
      comment: (report.comments as any) ? {
        id: (report.comments as any).id,
        content: (report.comments as any).content,
        userId: (report.comments as any).user_id,
        marketId: (report.comments as any).market_id,
      } as any : undefined,
    }));
  },

  // Admin: Update report status
  async updateReportStatus(
    reportId: string, 
    status: CommentReport['status'],
    actionTaken?: CommentReport['actionTaken']
  ): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Usuário não autenticado');
    }

    const { error } = await supabase
      .from('comment_reports')
      .update({
        status,
        action_taken: actionTaken || null,
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (error) {
      console.error('Error updating report:', error);
      throw new Error('Erro ao atualizar denúncia');
    }

    // If action is to hide or delete, update the comment
    if (actionTaken === 'hidden' || actionTaken === 'deleted') {
      const { data: report } = await supabase
        .from('comment_reports')
        .select('comment_id')
        .eq('id', reportId)
        .single();

      if (report) {
        if (actionTaken === 'hidden') {
          await supabase
            .from('comments')
            .update({ is_hidden: true })
            .eq('id', report.comment_id);
        } else if (actionTaken === 'deleted') {
          await supabase
            .from('comments')
            .delete()
            .eq('id', report.comment_id);
        }
      }
    }
  },

  // Get pending reports count
  async getPendingReportsCount(): Promise<number> {
    const { count, error } = await supabase
      .from('comment_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    if (error) {
      console.error('Error fetching pending reports count:', error);
      return 0;
    }

    return count || 0;
  },
};
