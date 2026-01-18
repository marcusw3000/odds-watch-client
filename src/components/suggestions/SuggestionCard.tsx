import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, CheckCircle2, XCircle, Clock, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VoteButtons } from './VoteButtons';
import type { Suggestion } from '@/types/suggestion';
import { cn } from '@/lib/utils';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onVote: (suggestionId: string, value: number) => Promise<void>;
  disabled?: boolean;
}

const statusConfig = {
  PENDING: {
    label: 'Pendente',
    icon: Clock,
    className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  },
  APPROVED: {
    label: 'Aprovado',
    icon: CheckCircle2,
    className: 'bg-green-500/10 text-green-500 border-green-500/20'
  },
  REJECTED: {
    label: 'Rejeitado',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-500 border-red-500/20'
  },
  IMPLEMENTED: {
    label: 'Implementado',
    icon: Rocket,
    className: 'bg-primary/10 text-primary border-primary/20'
  }
};

const categoryLabels: Record<string, string> = {
  economia: 'Economia',
  politica: 'Política',
  esportes: 'Esportes',
  entretenimento: 'Entretenimento',
  tecnologia: 'Tecnologia',
  ciencia: 'Ciência',
  cultura: 'Cultura',
  geral: 'Geral'
};

export function SuggestionCard({ suggestion, onVote, disabled }: SuggestionCardProps) {
  const status = statusConfig[suggestion.status];
  const StatusIcon = status.icon;

  return (
    <Card className="group hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Vote buttons */}
          <VoteButtons
            score={suggestion.score}
            upvotes={suggestion.upvotes}
            downvotes={suggestion.downvotes}
            userVote={suggestion.user_vote}
            onVote={(value) => onVote(suggestion.id, value)}
            disabled={disabled}
            size="md"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <Link 
              to={`/suggestions/${suggestion.id}`}
              className="block group-hover:text-primary transition-colors"
            >
              <h3 className="font-semibold text-lg line-clamp-1 mb-1">
                {suggestion.title}
              </h3>
            </Link>

            <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
              {suggestion.description}
            </p>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Author */}
              <Link 
                to={`/profile/${suggestion.user_id}`}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Avatar className="h-5 w-5 hover:ring-2 hover:ring-primary/50 transition-all">
                  <AvatarImage src={suggestion.author_avatar} />
                  <AvatarFallback className="text-[10px]">
                    {suggestion.author_name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground hover:text-primary hover:underline transition-colors">
                  {suggestion.author_name}
                </span>
              </Link>

              <span className="text-muted-foreground">•</span>

              {/* Time */}
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(suggestion.created_at), {
                  addSuffix: true,
                  locale: ptBR
                })}
              </span>

              <span className="text-muted-foreground">•</span>

              {/* Comments */}
              <div className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare size={12} />
                <span>{suggestion.comment_count}</span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <Badge variant="outline" className="text-xs">
                {categoryLabels[suggestion.category] || suggestion.category}
              </Badge>
              
              <Badge 
                variant="outline" 
                className={cn('text-xs flex items-center gap-1', status.className)}
              >
                <StatusIcon size={10} />
                {status.label}
              </Badge>

              {suggestion.market_id && (
                <Link to={`/market/${suggestion.market_id}`}>
                  <Badge variant="default" className="text-xs">
                    Ver Mercado
                  </Badge>
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
