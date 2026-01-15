import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Heart, Reply, MoreHorizontal, Flag, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Comment } from '@/types/comment';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface CommentItemProps {
  comment: Comment;
  onReply: () => void;
  onLike: () => void;
  onReport: () => void;
  onDelete?: () => void;
  isLiking?: boolean;
}

export function CommentItem({
  comment,
  onReply,
  onLike,
  onReport,
  onDelete,
  isLiking = false,
}: CommentItemProps) {
  const { user } = useAuth();
  const isOwner = user?.id === comment.userId;

  // Render content with highlighted mentions
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-primary font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex gap-3 py-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={comment.authorAvatar} />
        <AvatarFallback className="text-xs">
          {comment.authorName[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{comment.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(comment.createdAt, { addSuffix: true, locale: ptBR })}
          </span>
        </div>

        {comment.replyingToName && (
          <span className="text-xs text-muted-foreground">
            respondendo a <span className="text-primary">@{comment.replyingToName}</span>
          </span>
        )}

        <p className="text-sm mt-1 whitespace-pre-wrap break-words">
          {renderContent(comment.content)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1"
            onClick={onLike}
            disabled={isLiking || !user}
          >
            <Heart
              className={cn(
                'h-4 w-4 transition-colors',
                comment.isLikedByUser && 'fill-red-500 text-red-500'
              )}
            />
            <span className="text-xs">{comment.likesCount}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1"
            onClick={onReply}
            disabled={!user}
          >
            <Reply className="h-4 w-4" />
            <span className="text-xs">Responder</span>
          </Button>

          {comment.repliesCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {comment.repliesCount} {comment.repliesCount === 1 ? 'resposta' : 'respostas'}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-auto">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner && onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              )}
              {!isOwner && (
                <DropdownMenuItem onClick={onReport}>
                  <Flag className="h-4 w-4 mr-2" />
                  Denunciar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
