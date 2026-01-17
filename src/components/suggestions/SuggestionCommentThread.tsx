import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Heart, Reply, Trash2, Loader2, ChevronDown, ChevronUp, MessageSquare, Flag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MentionInput } from '@/components/market/MentionInput';
import { ReportCommentDialog } from '@/components/market/ReportCommentDialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SuggestionService } from '@/services/SuggestionService';
import type { SuggestionComment } from '@/types/suggestion';
import { cn } from '@/lib/utils';

interface SuggestionCommentThreadProps {
  comment: SuggestionComment;
  suggestionId: string;
  suggestionTitle?: string;
  depth?: number;
  onLike: (commentId: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReplyAdded: () => void;
}

const MAX_DEPTH = 3;

export function SuggestionCommentThread({
  comment,
  suggestionId,
  suggestionTitle = '',
  depth = 0,
  onLike,
  onDelete,
  onReplyAdded,
}: SuggestionCommentThreadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showReplies, setShowReplies] = useState(depth === 0);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyMentions, setReplyMentions] = useState<string[]>([]);
  const [replies, setReplies] = useState<SuggestionComment[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [hasLoadedReplies, setHasLoadedReplies] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const isOwner = user?.id === comment.user_id;
  const canNest = depth < MAX_DEPTH;
  const repliesCount = comment.replies_count || 0;

  // Auto-load replies for root comments that have replies
  useEffect(() => {
    if (depth === 0 && repliesCount > 0 && !hasLoadedReplies) {
      loadReplies();
    }
  }, [depth, repliesCount, hasLoadedReplies]);

  const loadReplies = async () => {
    if (hasLoadedReplies && replies.length > 0) {
      setShowReplies(true);
      return;
    }

    setIsLoadingReplies(true);
    try {
      const data = await SuggestionService.getComments(suggestionId, comment.id);
      setReplies(data);
      setHasLoadedReplies(true);
      setShowReplies(true);
    } catch (error) {
      console.error('Error loading replies:', error);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const handleReply = () => {
    if (!user) return;
    setIsReplying(true);
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;

    setIsSubmittingReply(true);
    try {
      await SuggestionService.addComment(suggestionId, replyContent.trim(), comment.id, replyMentions, suggestionTitle);
      setReplyContent('');
      setReplyMentions([]);
      setIsReplying(false);
      
      // Reload replies to show the new one
      const data = await SuggestionService.getComments(suggestionId, comment.id);
      setReplies(data);
      setHasLoadedReplies(true);
      setShowReplies(true);
      
      onReplyAdded();
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleLike = async () => {
    setIsLiking(true);
    try {
      await onLike(comment.id);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    await onDelete(replyId);
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
  };

  const handleReport = async (
    reason: 'spam' | 'offensive' | 'misinformation' | 'other',
    description?: string
  ) => {
    try {
      await SuggestionService.reportComment(comment.id, reason, description);
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

  return (
    <div className={cn('relative', depth > 0 && 'border-l-2 border-muted pl-4 ml-4')}>
      {/* Comment content */}
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
              onClick={handleLike}
              disabled={isLiking}
              className={cn(
                'flex items-center gap-1 transition-colors',
                comment.user_liked
                  ? 'text-red-500'
                  : 'text-muted-foreground hover:text-red-500'
              )}
            >
              {isLiking ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Heart
                  size={14}
                  className={comment.user_liked ? 'fill-current' : ''}
                />
              )}
              <span>{comment.likes_count}</span>
            </button>

            {user && (
              <button
                onClick={handleReply}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              >
                <Reply size={14} />
                <span>Responder</span>
              </button>
            )}

            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>
            )}

            {user && !isOwner && (
              <button
                onClick={() => setShowReportDialog(true)}
                className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Flag size={14} />
                <span>Denunciar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply form */}
      {isReplying && (
        <div className="mt-3 ml-11 pl-3 border-l-2 border-muted">
          <MentionInput
            value={replyContent}
            onChange={setReplyContent}
            onMentionsChange={setReplyMentions}
            placeholder={`Respondendo a ${comment.author_name}... Use @ para mencionar`}
            minHeight="60px"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => setIsReplying(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitReply}
              disabled={isSubmittingReply || !replyContent.trim()}
            >
              {isSubmittingReply && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Responder
            </Button>
          </div>
        </div>
      )}

      {/* Show/Load Replies Button */}
      {repliesCount > 0 && !showReplies && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 ml-11 mt-2 text-muted-foreground hover:text-foreground"
          onClick={loadReplies}
          disabled={isLoadingReplies}
        >
          {isLoadingReplies ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 mr-1" />
              Ver {repliesCount} {repliesCount === 1 ? 'resposta' : 'respostas'}
              <ChevronDown className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      )}

      {/* Collapse Replies Button */}
      {repliesCount > 0 && showReplies && replies.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 ml-11 mt-2 text-muted-foreground hover:text-foreground"
          onClick={() => setShowReplies(false)}
        >
          <ChevronUp className="h-4 w-4 mr-1" />
          Ocultar respostas
        </Button>
      )}

      {/* Nested Replies */}
      {showReplies && replies.length > 0 && canNest && (
        <div className="mt-2">
          {replies.map((reply) => (
            <SuggestionCommentThread
              key={reply.id}
              comment={reply}
              suggestionId={suggestionId}
              suggestionTitle={suggestionTitle}
              depth={depth + 1}
              onLike={onLike}
              onDelete={handleDeleteReply}
              onReplyAdded={onReplyAdded}
            />
          ))}
        </div>
      )}

      {/* Flat replies if max depth reached */}
      {showReplies && replies.length > 0 && !canNest && (
        <div className="mt-2 space-y-3">
          {replies.map((reply) => (
            <div key={reply.id} className="border-l-2 border-muted pl-4 ml-4">
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={reply.author_avatar} />
                  <AvatarFallback>
                    {reply.author_name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{reply.author_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(reply.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  <p className="text-sm text-foreground/90 mb-2">{reply.content}</p>

                  <div className="flex items-center gap-3 text-xs">
                    <button
                      onClick={() => onLike(reply.id)}
                      className={cn(
                        'flex items-center gap-1 transition-colors',
                        reply.user_liked
                          ? 'text-red-500'
                          : 'text-muted-foreground hover:text-red-500'
                      )}
                    >
                      <Heart
                        size={14}
                        className={reply.user_liked ? 'fill-current' : ''}
                      />
                      <span>{reply.likes_count}</span>
                    </button>

                    {user?.id === reply.user_id && (
                      <button
                        onClick={() => handleDeleteReply(reply.id)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Dialog */}
      <ReportCommentDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onSubmit={handleReport}
      />
    </div>
  );
}
