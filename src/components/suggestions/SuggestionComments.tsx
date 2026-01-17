import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Heart, Reply, Trash2, Loader2, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SuggestionService } from '@/services/SuggestionService';
import type { SuggestionComment } from '@/types/suggestion';
import { cn } from '@/lib/utils';

interface SuggestionCommentsProps {
  suggestionId: string;
}

export function SuggestionComments({ suggestionId }: SuggestionCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<SuggestionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const loadComments = useCallback(async () => {
    try {
      const data = await SuggestionService.getComments(suggestionId);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  }, [suggestionId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    try {
      await SuggestionService.addComment(suggestionId, newComment.trim());
      setNewComment('');
      await loadComments();
      toast({
        title: 'Comentário enviado!',
        description: 'Seu comentário foi publicado.',
      });
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o comentário.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!user || !replyContent.trim()) return;

    setSubmitting(true);
    try {
      await SuggestionService.addComment(suggestionId, replyContent.trim(), parentId);
      setReplyContent('');
      setReplyingTo(null);
      await loadComments();
    } catch (error) {
      console.error('Error submitting reply:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a resposta.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!user) {
      toast({
        title: 'Faça login',
        description: 'Você precisa estar logado para curtir comentários.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await SuggestionService.toggleCommentLike(commentId);
      await loadComments();
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await SuggestionService.deleteComment(commentId);
      await loadComments();
      toast({
        title: 'Comentário excluído',
        description: 'Seu comentário foi removido.',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o comentário.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* New comment form */}
      {user ? (
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback>
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicione um comentário..."
              className="min-h-[80px] resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={submitting || !newComment.trim()}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Faça login para comentar
        </p>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum comentário ainda. Seja o primeiro!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onLike={() => handleLike(comment.id)}
              onReply={() => setReplyingTo(comment.id)}
              onDelete={() => handleDelete(comment.id)}
              isReplying={replyingTo === comment.id}
              replyContent={replyContent}
              onReplyContentChange={setReplyContent}
              onSubmitReply={() => handleSubmitReply(comment.id)}
              onCancelReply={() => setReplyingTo(null)}
              submitting={submitting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: SuggestionComment;
  currentUserId?: string;
  onLike: () => void;
  onReply: () => void;
  onDelete: () => void;
  isReplying: boolean;
  replyContent: string;
  onReplyContentChange: (value: string) => void;
  onSubmitReply: () => void;
  onCancelReply: () => void;
  submitting: boolean;
}

function CommentItem({
  comment,
  currentUserId,
  onLike,
  onReply,
  onDelete,
  isReplying,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
  onCancelReply,
  submitting,
}: CommentItemProps) {
  const isOwner = currentUserId === comment.user_id;

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={comment.author_avatar} />
        <AvatarFallback>
          {comment.author_name?.charAt(0).toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{comment.author_name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>

        <p className="text-sm text-foreground/90 mb-2">{comment.content}</p>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={onLike}
            className={cn(
              'flex items-center gap-1 transition-colors',
              comment.user_liked
                ? 'text-red-500'
                : 'text-muted-foreground hover:text-red-500'
            )}
          >
            <Heart
              size={14}
              className={comment.user_liked ? 'fill-current' : ''}
            />
            <span>{comment.likes_count}</span>
          </button>

          <button
            onClick={onReply}
            className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <Reply size={14} />
            <span>Responder</span>
          </button>

          {isOwner && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={14} />
              <span>Excluir</span>
            </button>
          )}
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mt-3 pl-3 border-l-2 border-muted">
            <Textarea
              value={replyContent}
              onChange={(e) => onReplyContentChange(e.target.value)}
              placeholder="Escreva sua resposta..."
              className="min-h-[60px] resize-none text-sm"
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button size="sm" variant="ghost" onClick={onCancelReply}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={onSubmitReply}
                disabled={submitting || !replyContent.trim()}
              >
                {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Responder
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
