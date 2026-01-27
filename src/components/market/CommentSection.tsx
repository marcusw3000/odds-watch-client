import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Comment } from '@/types/comment';
import { CommentService } from '@/services/CommentService';
import { CommentThread } from './CommentThread';
import { MentionInput } from './MentionInput';
import { ReportCommentDialog } from './ReportCommentDialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface CommentSectionProps {
  marketId: string;
}

export function CommentSection({ marketId }: CommentSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await CommentService.getRootComments(marketId, user?.id);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [marketId, user?.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Realtime subscription for new comments
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${marketId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'comments', 
          filter: `market_id=eq.${marketId}` 
        },
        (payload) => {
          // Reload comments when a new comment is added by another user
          if (payload.new && (payload.new as { user_id: string }).user_id !== user?.id) {
            loadComments();
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'comments', 
          filter: `market_id=eq.${marketId}` 
        },
        () => {
          // Reload comments when a comment is deleted
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, user?.id, loadComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmitting) return;

    if (!user) {
      navigate('/auth', { state: { returnTo: location.pathname } });
      return;
    }

    setIsSubmitting(true);
    try {
      const comment = await CommentService.createComment(
        marketId,
        newComment.trim(),
        mentions
      );

      if (comment) {
        setComments((prev) => [comment, ...prev]);
        setNewComment('');
        setMentions([]);
        toast({
          title: 'Comentário publicado',
          description: 'Seu comentário foi adicionado com sucesso.',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao publicar',
        description: 'Não foi possível publicar seu comentário. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!user) {
      navigate('/auth', { state: { returnTo: location.pathname } });
      return;
    }

    try {
      const isNowLiked = await CommentService.likeComment(commentId);
      
      // Update local state
      const updateCommentLike = (comments: Comment[]): Comment[] => {
        return comments.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              isLikedByUser: isNowLiked,
              likesCount: isNowLiked ? c.likesCount + 1 : c.likesCount - 1,
            };
          }
          return c;
        });
      };

      setComments(updateCommentLike);
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleReport = (commentId: string) => {
    if (!user) {
      navigate('/auth', { state: { returnTo: location.pathname } });
      return;
    }
    setReportingCommentId(commentId);
  };

  const handleSubmitReport = async (
    reason: 'spam' | 'offensive' | 'misinformation' | 'other',
    description?: string
  ) => {
    if (!reportingCommentId) return;

    try {
      await CommentService.reportComment(reportingCommentId, reason, description);
      toast({
        title: 'Denúncia enviada',
        description: 'Obrigado por ajudar a manter a comunidade segura.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao denunciar',
        description: 'Não foi possível enviar a denúncia. Tente novamente.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await CommentService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast({
        title: 'Comentário excluído',
        description: 'Seu comentário foi removido.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o comentário.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* New Comment Form */}
      <Card>
        <CardContent className="p-4">
          {user ? (
            <div className="space-y-3">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                onMentionsChange={setMentions}
                placeholder="Escreva seu comentário... Use @ para mencionar usuários"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Publicar
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-3">
                Faça login para participar da discussão
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/auth', { state: { returnTo: location.pathname } })}
              >
                Entrar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments List */}
      {comments.length > 0 ? (
        <Card>
          <CardContent className="p-4 divide-y divide-border">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                marketId={marketId}
                onLike={handleLike}
                onReport={handleReport}
                onDelete={handleDelete}
                onReplyAdded={loadComments}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Nenhum comentário ainda</p>
            <p className="text-sm">Seja o primeiro a comentar!</p>
          </CardContent>
        </Card>
      )}

      {/* Report Dialog */}
      <ReportCommentDialog
        open={!!reportingCommentId}
        onOpenChange={(open) => !open && setReportingCommentId(null)}
        onSubmit={handleSubmitReport}
      />
    </div>
  );
}
