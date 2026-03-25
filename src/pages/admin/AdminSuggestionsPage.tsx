import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Lightbulb, 
  RefreshCw, 
  Search, 
  Eye, 
  Check, 
  X, 
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Rocket,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { SuggestionService } from '@/services/SuggestionService';
import { notifySuggestionApproved, notifySuggestionRejected } from '@/services/NotificationService';
import { Suggestion, SuggestionStatus } from '@/types/suggestion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const statusConfig: Record<SuggestionStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING: { label: 'Pendente', icon: Clock, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  APPROVED: { label: 'Aprovada', icon: CheckCircle, className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  REJECTED: { label: 'Rejeitada', icon: XCircle, className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  IMPLEMENTED: { label: 'Implementada', icon: Rocket, className: 'bg-primary/10 text-primary border-primary/20' },
};

const categoryLabels: Record<string, string> = {
  economia: 'Economia',
  politica: 'Política',
  esportes: 'Esportes',
  tecnologia: 'Tecnologia',
  entretenimento: 'Entretenimento',
  outros: 'Outros',
};

export function AdminSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    implemented: 0,
  });
  
  // Modal state
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSuggestions = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    
    try {
      const result = await SuggestionService.getAdminSuggestions({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      
      setSuggestions(result);
      
      // Calculate stats from all suggestions
      const allSuggestions = await SuggestionService.getAdminSuggestions({});
      setStats({
        pending: allSuggestions.filter(s => s.status === 'PENDING').length,
        approved: allSuggestions.filter(s => s.status === 'APPROVED').length,
        rejected: allSuggestions.filter(s => s.status === 'REJECTED').length,
        implemented: allSuggestions.filter(s => s.status === 'IMPLEMENTED').length,
      });
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast.error('Erro ao carregar sugestões');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [statusFilter]);

  const handleRefresh = () => fetchSuggestions(true);

  const openReviewModal = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    setAdminNotes('');
    setShowReviewModal(true);
  };

  const handleApprove = async () => {
    if (!selectedSuggestion) return;
    
    setActionLoading(true);
    try {
      await SuggestionService.reviewSuggestion(selectedSuggestion.id, {
        status: 'APPROVED',
        admin_notes: adminNotes || undefined,
      });
      toast.success('Sugestão aprovada com sucesso');
      try {
        await notifySuggestionApproved(selectedSuggestion.user_id, selectedSuggestion.id, selectedSuggestion.title);
      } catch (e) { console.error('Notification error:', e); }
      setShowReviewModal(false);
      fetchSuggestions(true);
    } catch (error) {
      console.error('Error approving suggestion:', error);
      toast.error('Erro ao aprovar sugestão');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSuggestion) return;
    
    if (!adminNotes.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }
    
    setActionLoading(true);
    try {
      await SuggestionService.reviewSuggestion(selectedSuggestion.id, {
        status: 'REJECTED',
        admin_notes: adminNotes,
      });
      toast.success('Sugestão rejeitada');
      setShowReviewModal(false);
      fetchSuggestions(true);
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      toast.error('Erro ao rejeitar sugestão');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter suggestions by search and category
  const filteredSuggestions = suggestions.filter(s => {
    const matchesSearch = !search || 
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Sugestões de Mercados</h1>
            <p className="text-muted-foreground">Gerencie sugestões enviadas pela comunidade</p>
          </div>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className={cn("cursor-pointer transition-colors hover:border-primary", statusFilter === 'PENDING' && "border-primary")}
          onClick={() => setStatusFilter('PENDING')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card 
          className={cn("cursor-pointer transition-colors hover:border-primary", statusFilter === 'APPROVED' && "border-primary")}
          onClick={() => setStatusFilter('APPROVED')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card 
          className={cn("cursor-pointer transition-colors hover:border-primary", statusFilter === 'REJECTED' && "border-primary")}
          onClick={() => setStatusFilter('REJECTED')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>
        <Card 
          className={cn("cursor-pointer transition-colors hover:border-primary", statusFilter === 'IMPLEMENTED' && "border-primary")}
          onClick={() => setStatusFilter('IMPLEMENTED')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Implementadas</CardTitle>
            <Rocket className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.implemented}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar sugestões..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="PENDING">Pendentes</SelectItem>
            <SelectItem value="APPROVED">Aprovadas</SelectItem>
            <SelectItem value="REJECTED">Rejeitadas</SelectItem>
            <SelectItem value="IMPLEMENTED">Implementadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sugestão</TableHead>
              <TableHead className="hidden md:table-cell">Autor</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuggestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma sugestão encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredSuggestions.map((suggestion) => {
                const StatusIcon = statusConfig[suggestion.status].icon;
                return (
                  <TableRow key={suggestion.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium line-clamp-1">{suggestion.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {categoryLabels[suggestion.category] || suggestion.category}
                          </Badge>
                          <span className="hidden sm:inline">
                            {format(new Date(suggestion.created_at), "dd MMM yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {suggestion.author_name || 'Anônimo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center gap-1 text-success">
                          <ThumbsUp className="h-3 w-3" />
                          <span className="text-sm">{suggestion.upvotes}</span>
                        </div>
                        <div className="flex items-center gap-1 text-destructive">
                          <ThumbsDown className="h-3 w-3" />
                          <span className="text-sm">{suggestion.downvotes}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          <span className="text-sm">{suggestion.comment_count}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={cn("gap-1", statusConfig[suggestion.status].className)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[suggestion.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openReviewModal(suggestion)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {(suggestion.status === 'APPROVED' || suggestion.status === 'PENDING') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-primary hover:text-primary"
                            asChild
                            title="Criar Mercado"
                          >
                            <Link to={`/admin/events/new?suggestion_id=${suggestion.id}`}>
                              <Plus className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisar Sugestão</DialogTitle>
            <DialogDescription>
              Analise a sugestão e decida se deve ser aprovada ou rejeitada
            </DialogDescription>
          </DialogHeader>
          
          {selectedSuggestion && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Título</Label>
                <p className="font-medium">{selectedSuggestion.title}</p>
              </div>
              
              <div>
                <Label className="text-muted-foreground text-xs">Descrição</Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedSuggestion.description}
                </p>
              </div>
              
              <div className="flex gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Categoria</Label>
                  <p className="text-sm">{categoryLabels[selectedSuggestion.category]}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Score</Label>
                  <p className="text-sm font-mono">
                    +{selectedSuggestion.upvotes} / -{selectedSuggestion.downvotes}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Comentários</Label>
                  <p className="text-sm">{selectedSuggestion.comment_count}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground text-xs">Autor</Label>
                <p className="text-sm">
                  {selectedSuggestion.author_name || 'Anônimo'} • {' '}
                  {format(new Date(selectedSuggestion.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Notas do Admin</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adicione um comentário ou motivo da decisão..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedSuggestion?.status === 'PENDING' && (
              <>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive hover:bg-destructive/10"
                  onClick={handleReject}
                  disabled={actionLoading}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  variant="outline"
                  className="text-success border-success hover:bg-success/10"
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
              </>
            )}
            {(selectedSuggestion?.status === 'APPROVED' || selectedSuggestion?.status === 'PENDING') && (
              <Button asChild>
                <Link to={`/admin/events/new?suggestion_id=${selectedSuggestion?.id}`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Mercado
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
