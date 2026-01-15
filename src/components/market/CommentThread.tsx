import { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Comment } from '@/types/comment';
import { CommentItem } from './CommentItem';
import { ReplyForm } from './ReplyForm';
import { CommentService } from '@/services/CommentService';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface CommentThreadProps {
  comment: Comment;
  marketId: string;
  depth?: number;
  onLike: (commentId: string) => Promise<void>;
  onReport: (commentId: string) => void;
  onDelete: (commentId: string) => Promise<void>;
  onReplyAdded: () => void;
}

const MAX_DEPTH = 3;

export function CommentThread({
  comment,
  marketId,
  depth = 0,
  onLike,
  onReport,
  onDelete,
  onReplyAdded,
}: CommentThreadProps) {
  const { user } = useAuth();
  const [showReplies, setShowReplies] = useState(depth === 0);
  const [isReplying, setIsReplying] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [hasLoadedReplies, setHasLoadedReplies] = useState(false);

  const loadReplies = async () => {
    if (hasLoadedReplies && replies.length > 0) {
      setShowReplies(true);
      return;
    }

    setIsLoadingReplies(true);
    try {
      const data = await CommentService.getReplies(comment.id, user?.id);
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

  const handleSubmitReply = async (content: string, mentions: string[]) => {
    setIsSubmittingReply(true);
    try {
      const newReply = await CommentService.createComment(
        marketId,
        content,
        mentions,
        comment.id
      );

      if (newReply) {
        // Add to local replies
        setReplies((prev) => [...prev, newReply]);
        setShowReplies(true);
        setHasLoadedReplies(true);
        // Update parent's reply count
        comment.repliesCount += 1;
      }

      setIsReplying(false);
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
    comment.repliesCount = Math.max(0, comment.repliesCount - 1);
  };

  const canNest = depth < MAX_DEPTH;

  return (
    <div className={cn('relative', depth > 0 && 'border-l-2 border-muted pl-4 ml-4')}>
      <CommentItem
        comment={comment}
        onReply={handleReply}
        onLike={handleLike}
        onReport={() => onReport(comment.id)}
        onDelete={user?.id === comment.userId ? () => onDelete(comment.id) : undefined}
        isLiking={isLiking}
      />

      {/* Reply Form */}
      {isReplying && (
        <ReplyForm
          replyingTo={comment.authorName}
          onSubmit={handleSubmitReply}
          onCancel={() => setIsReplying(false)}
          isSubmitting={isSubmittingReply}
        />
      )}

      {/* Show/Load Replies Button */}
      {comment.repliesCount > 0 && !showReplies && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 ml-11 text-muted-foreground hover:text-foreground"
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
              Ver {comment.repliesCount}{' '}
              {comment.repliesCount === 1 ? 'resposta' : 'respostas'}
              <ChevronDown className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      )}

      {/* Collapse Replies Button */}
      {comment.repliesCount > 0 && showReplies && replies.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 ml-11 text-muted-foreground hover:text-foreground"
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
            <CommentThread
              key={reply.id}
              comment={reply}
              marketId={marketId}
              depth={depth + 1}
              onLike={onLike}
              onReport={onReport}
              onDelete={handleDeleteReply}
              onReplyAdded={onReplyAdded}
            />
          ))}
        </div>
      )}

      {/* Flat replies if max depth reached */}
      {showReplies && replies.length > 0 && !canNest && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <div key={reply.id} className="border-l-2 border-muted pl-4 ml-4">
              <CommentItem
                comment={reply}
                onReply={() => {}} // No nested reply at max depth
                onLike={() => onLike(reply.id)}
                onReport={() => onReport(reply.id)}
                onDelete={
                  user?.id === reply.userId
                    ? () => handleDeleteReply(reply.id)
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
