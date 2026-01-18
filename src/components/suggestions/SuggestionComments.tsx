import { useState, useEffect, useCallback } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MentionInput } from '@/components/market/MentionInput';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SuggestionService } from '@/services/SuggestionService';
import { SuggestionCommentThread } from './SuggestionCommentThread';
import type { SuggestionComment } from '@/types/suggestion';

interface SuggestionCommentsProps {
  suggestionId: string;
  suggestionTitle?: string;
}

export function SuggestionComments({ suggestionId, suggestionTitle = '' }: SuggestionCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<SuggestionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
      await SuggestionService.addComment(suggestionId, newComment.trim(), undefined, mentions, suggestionTitle);
      setNewComment('');
      setMentions([]);
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

  const handleReplyAdded = () => {
    loadComments();
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
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              onMentionsChange={setMentions}
              placeholder="Adicione um comentário... Use @ para mencionar"
              minHeight="80px"
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
        <div className="space-y-6">
          {comments.map((comment) => (
            <SuggestionCommentThread
              key={comment.id}
              comment={comment}
              suggestionId={suggestionId}
              suggestionTitle={suggestionTitle}
              onLike={handleLike}
              onDelete={handleDelete}
              onReplyAdded={handleReplyAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
