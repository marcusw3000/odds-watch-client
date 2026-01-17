import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Rocket,
  MessageSquare,
  Calendar,
  User,
  Trash2,
  Edit,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { VoteButtons, SuggestionComments, SuggestionForm } from '@/components/suggestions';
import { SuggestionService } from '@/services/SuggestionService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Suggestion } from '@/types/suggestion';
import { cn } from '@/lib/utils';

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

export function SuggestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    const loadSuggestion = async () => {
      if (!id) return;
      try {
        const data = await SuggestionService.getSuggestionById(id);
        if (!data) {
          navigate('/suggestions');
          return;
        }
        setSuggestion(data);
      } catch (error) {
        console.error('Error loading suggestion:', error);
        navigate('/suggestions');
      } finally {
        setLoading(false);
      }
    };

    loadSuggestion();
  }, [id, navigate]);

  const handleVote = async (value: number) => {
    if (!user || !suggestion) {
      toast({
        title: 'Faça login',
        description: 'Você precisa estar logado para votar.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    try {
      const result = await SuggestionService.vote(suggestion.id, value);
      setSuggestion(prev => prev ? {
        ...prev,
        score: result.score,
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        user_vote: result.user_vote
      } : null);
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: 'Erro ao votar',
        description: 'Não foi possível registrar seu voto.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!suggestion) return;
    setDeleting(true);
    try {
      await SuggestionService.deleteSuggestion(suggestion.id);
      toast({
        title: 'Sugestão excluída',
        description: 'Sua sugestão foi removida com sucesso.',
      });
      navigate('/suggestions');
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a sugestão.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = (updated: Suggestion) => {
    setSuggestion(updated);
    setShowEditForm(false);
    toast({
      title: 'Sugestão atualizada',
      description: 'As alterações foram salvas.',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Skeleton className="h-8 w-32 mb-6" />
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-6">
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!suggestion) return null;

  const status = statusConfig[suggestion.status];
  const StatusIcon = status.icon;
  const isOwner = user?.id === suggestion.user_id;
  const canEdit = isOwner && suggestion.status === 'PENDING';

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Back button */}
      <Button
        variant="ghost"
        className="mb-4 -ml-2"
        onClick={() => navigate('/suggestions')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Sugestões
      </Button>

      {/* Main card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex gap-6">
            {/* Vote buttons - larger on detail page */}
            <VoteButtons
              score={suggestion.score}
              upvotes={suggestion.upvotes}
              downvotes={suggestion.downvotes}
              userVote={suggestion.user_vote}
              onVote={handleVote}
              disabled={!user}
              size="lg"
            />

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-2xl font-bold">{suggestion.title}</h1>
                
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowEditForm(true)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" disabled={deleting}>
                          {deleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir sugestão?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A sugestão será removida permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={suggestion.author_avatar} />
                    <AvatarFallback className="text-xs">
                      {suggestion.author_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{suggestion.author_name}</span>
                </div>

                <span>•</span>

                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span>
                    {format(new Date(suggestion.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>

                <span>•</span>

                <div className="flex items-center gap-1">
                  <MessageSquare size={14} />
                  <span>{suggestion.comment_count} comentários</span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <Badge variant="outline">
                  {categoryLabels[suggestion.category] || suggestion.category}
                </Badge>
                
                <Badge 
                  variant="outline" 
                  className={cn('flex items-center gap-1', status.className)}
                >
                  <StatusIcon size={12} />
                  {status.label}
                </Badge>

                {suggestion.market_id && (
                  <Link to={`/market/${suggestion.market_id}`}>
                    <Badge variant="default" className="cursor-pointer">
                      Ver Mercado Criado →
                    </Badge>
                  </Link>
                )}
              </div>

              <Separator className="my-4" />

              {/* Description */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{suggestion.description}</p>
              </div>

              {/* Admin notes if rejected */}
              {suggestion.status === 'REJECTED' && suggestion.admin_notes && (
                <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <h4 className="font-medium text-destructive mb-2">Motivo da rejeição:</h4>
                  <p className="text-sm text-muted-foreground">{suggestion.admin_notes}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comments section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentários ({suggestion.comment_count})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuggestionComments suggestionId={suggestion.id} />
        </CardContent>
      </Card>

      {/* Edit form modal */}
      {canEdit && (
        <SuggestionForm
          open={showEditForm}
          onOpenChange={setShowEditForm}
          onSuccess={handleEditSuccess}
          editSuggestion={suggestion}
        />
      )}
    </div>
  );
}
