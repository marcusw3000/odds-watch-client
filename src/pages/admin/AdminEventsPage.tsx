import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit, 
  Pause, 
  Play, 
  Lock, 
  Scale,
  Trash2,
  MoreHorizontal,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdminRepository } from '@/services/AdminRepository';
import { MarketEvent, EVENT_CATEGORIES } from '@/types/admin';
import { MarketStatus, MARKET_STATUS_LABELS, MARKET_STATUS_VARIANTS } from '@/types/market';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export function AdminEventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; event: MarketEvent | null }>({
    open: false,
    event: null,
  });
  const [statusDialog, setStatusDialog] = useState<{ 
    open: boolean; 
    event: MarketEvent | null; 
    action: 'pause' | 'resume' | 'close' | null 
  }>({
    open: false,
    event: null,
    action: null,
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = () => {
    setEvents(AdminRepository.getEvents());
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.category.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || event.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleStatusChange = (event: MarketEvent, action: 'pause' | 'resume' | 'close') => {
    setStatusDialog({ open: true, event, action });
  };

  const confirmStatusChange = () => {
    if (!statusDialog.event || !statusDialog.action) return;

    const statusMap: Record<string, MarketStatus> = {
      pause: 'HALTED',
      resume: 'OPEN',
      close: 'PENDING',
    };

    const result = AdminRepository.updateStatus(
      statusDialog.event.id,
      statusMap[statusDialog.action]
    );

    if (result) {
      toast.success(`Evento ${statusDialog.action === 'pause' ? 'pausado' : statusDialog.action === 'resume' ? 'reativado' : 'fechado'} com sucesso`);
      loadEvents();
    }

    setStatusDialog({ open: false, event: null, action: null });
  };

  const handleDelete = (event: MarketEvent) => {
    setDeleteDialog({ open: true, event });
  };

  const confirmDelete = () => {
    if (!deleteDialog.event) return;

    const success = AdminRepository.deleteEvent(deleteDialog.event.id);
    if (success) {
      toast.success('Evento excluído com sucesso');
      loadEvents();
    } else {
      toast.error('Erro ao excluir evento');
    }

    setDeleteDialog({ open: false, event: null });
  };

  const getStatusBadge = (status: MarketStatus) => {
    return <Badge variant={MARKET_STATUS_VARIANTS[status]}>{MARKET_STATUS_LABELS[status]}</Badge>;
  };

  const getSourceTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      API: 'bg-blue-500/10 text-blue-500',
      DATASET: 'bg-purple-500/10 text-purple-500',
      MANUAL: 'bg-gray-500/10 text-gray-500',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] || colors.MANUAL}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Eventos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os eventos do mercado preditivo
          </p>
        </div>
        <Link to="/admin/events/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar eventos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="OPEN">Aberto</SelectItem>
            <SelectItem value="HALTED">Pausado</SelectItem>
            <SelectItem value="PENDING">Aguardando Resultado</SelectItem>
            <SelectItem value="CONTESTED">Em Contestação</SelectItem>
            <SelectItem value="SETTLED">Encerrado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {EVENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Odds SIM / NÃO</TableHead>
              <TableHead>Expiração</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum evento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Link 
                      to={`/admin/events/${event.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {event.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{event.category}</span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(event.status)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono">
                      {event.odds.yes}% / {event.odds.no}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {format(event.expiryAt, "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getSourceTypeBadge(event.resolutionSource.type)}
                      {event.resolutionSource.url && (
                        <a
                          href={event.resolutionSource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {format(event.updatedAt, "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {event.status !== 'SETTLED' && (
                          <>
                            <DropdownMenuItem onClick={() => navigate(`/admin/events/${event.id}/edit`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            
                            {event.status === 'OPEN' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(event, 'pause')}>
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </DropdownMenuItem>
                            )}
                            
                            {event.status === 'HALTED' && (
                              <>
                                <DropdownMenuItem onClick={() => handleStatusChange(event, 'resume')}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Abrir Mercado
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(event, 'close')}>
                                  <Lock className="h-4 w-4 mr-2" />
                                  Submeter para Liquidação
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {(event.status === 'OPEN') && (
                              <DropdownMenuItem onClick={() => handleStatusChange(event, 'close')}>
                                <Lock className="h-4 w-4 mr-2" />
                                Fechar Mercado
                              </DropdownMenuItem>
                            )}
                            
                            {(event.status === 'PENDING' || event.status === 'CONTESTED') && (
                              <DropdownMenuItem onClick={() => navigate(`/admin/settlements?event=${event.id}`)}>
                                <Scale className="h-4 w-4 mr-2" />
                                Liquidar
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                          </>
                        )}
                        
                        <DropdownMenuItem onClick={() => navigate(`/admin/events/${event.id}`)}>
                          Visualizar
                        </DropdownMenuItem>
                        
                        {event.status === 'HALTED' && (
                          <DropdownMenuItem 
                            onClick={() => handleDelete(event)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Status Change Dialog */}
      <AlertDialog open={statusDialog.open} onOpenChange={(open) => !open && setStatusDialog({ open: false, event: null, action: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusDialog.action === 'pause' && 'Pausar Evento'}
              {statusDialog.action === 'resume' && 'Reabrir Evento'}
              {statusDialog.action === 'close' && 'Fechar Mercado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusDialog.action === 'pause' && 'O evento será pausado e não aceitará novas apostas até ser reaberto.'}
              {statusDialog.action === 'resume' && 'O evento será reaberto e voltará a aceitar apostas.'}
              {statusDialog.action === 'close' && 'O mercado será fechado permanentemente. Após fechado, só poderá ser liquidado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, event: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteDialog.event?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
