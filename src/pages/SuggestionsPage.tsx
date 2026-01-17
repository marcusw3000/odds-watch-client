import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Clock, MessageSquare, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SuggestionCard, SuggestionForm } from '@/components/suggestions';
import { SuggestionService } from '@/services/SuggestionService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Suggestion, SuggestionSortOption, SuggestionFilterOption } from '@/types/suggestion';
import { Skeleton } from '@/components/ui/skeleton';

export function SuggestionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SuggestionFilterOption>('all');
  const [sort, setSort] = useState<SuggestionSortOption>('trending');
  const [category, setCategory] = useState<string>('');
  const [showForm, setShowForm] = useState(false);

  const categories = SuggestionService.getCategories();

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      let data: Suggestion[];
      
      if (filter === 'mine' && user) {
        data = await SuggestionService.getMySuggestions(user.id);
      } else {
        data = await SuggestionService.getSuggestions({
          limit: 50,
          sort,
          filter: filter === 'mine' ? undefined : filter,
          category: category || undefined,
        });
      }
      
      setSuggestions(data);
    } catch (error) {
      console.error('Error loading suggestions:', error);
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as sugestões.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [filter, sort, category, user, toast]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleVote = async (suggestionId: string, value: number) => {
    if (!user) {
      toast({
        title: 'Faça login',
        description: 'Você precisa estar logado para votar.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    try {
      const result = await SuggestionService.vote(suggestionId, value);
      
      // Update local state
      setSuggestions(prev => prev.map(s => 
        s.id === suggestionId 
          ? { 
              ...s, 
              score: result.score, 
              upvotes: result.upvotes, 
              downvotes: result.downvotes,
              user_vote: result.user_vote 
            }
          : s
      ));
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: 'Erro ao votar',
        description: 'Não foi possível registrar seu voto.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateSuccess = (suggestion: Suggestion) => {
    setSuggestions(prev => [suggestion, ...prev]);
    toast({
      title: 'Sugestão criada!',
      description: 'Sua sugestão foi publicada e está disponível para votação.',
    });
  };

  const handleOpenForm = () => {
    if (!user) {
      toast({
        title: 'Faça login',
        description: 'Você precisa estar logado para sugerir um mercado.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }
    setShowForm(true);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Sugestões de Mercados
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Vote nas melhores ideias e sugira novos mercados
          </p>
        </div>
        <Button onClick={handleOpenForm} className="gap-2">
          <Plus size={18} />
          Sugerir Mercado
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Tabs 
          value={filter} 
          onValueChange={(v) => setFilter(v as SuggestionFilterOption)} 
          className="flex-1"
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            <TabsTrigger value="implemented">Implementados</TabsTrigger>
            {user && <TabsTrigger value="mine">Minhas</TabsTrigger>}
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SuggestionSortOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trending">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} />
                  Trending
                </div>
              </SelectItem>
              <SelectItem value="recent">
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  Recentes
                </div>
              </SelectItem>
              <SelectItem value="most_commented">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} />
                  Mais Comentados
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Suggestions List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-12">
          <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma sugestão encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {filter === 'mine' 
              ? 'Você ainda não fez nenhuma sugestão.'
              : 'Seja o primeiro a sugerir um mercado!'}
          </p>
          <Button onClick={handleOpenForm} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Criar Sugestão
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onVote={handleVote}
              disabled={!user}
            />
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      <SuggestionForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
