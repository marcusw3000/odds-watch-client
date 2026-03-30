import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Headphones,
  Search,
  Filter,
  Loader2,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Send,
  X,
  Calendar,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TablePagination } from '@/components/ui/table-pagination';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import {
  getAllTickets,
  getTicketMessages,
  getTicketStats,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  sendStaffMessage,
  type TicketFilters,
  type TicketsResponse,
} from '@/services/SupportService';
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  type SupportTicket,
  type SupportStatus,
  type SupportCategory,
  type SupportPriority,
} from '@/types/support';
import { cn } from '@/lib/utils';

const STATUS_VARIANTS: Record<SupportStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'default',
  in_progress: 'secondary',
  waiting_customer: 'outline',
  resolved: 'secondary',
  closed: 'outline',
};

const PRIORITY_VARIANTS: Record<SupportPriority, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'default',
  urgent: 'destructive',
};

type DateFilter = 'all' | 'today' | 'week' | 'month';

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  all: 'Qualquer data',
  today: 'Hoje',
  week: 'Últimos 7 dias',
  month: 'Últimos 30 dias',
};

export default function AdminSupportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TicketFilters>({});
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  // Debounce search
  const debouncedSearch = useDebounce(search, 300);

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch || undefined }));
  }, [debouncedSearch]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.category) count++;
    if (filters.priority) count++;
    if (filters.assignedTo) count++;
    if (dateFilter !== 'all') count++;
    return count;
  }, [filters, dateFilter]);

  const hasActiveFilters = activeFilterCount > 0 || !!debouncedSearch;

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
    setSearch('');
    setDateFilter('all');
  };

  // Remove individual filter
  const removeFilter = (key: keyof TicketFilters | 'date') => {
    if (key === 'date') {
      setDateFilter('all');
    } else {
      setFilters((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['support-stats'],
    queryFn: getTicketStats,
    refetchInterval: 30000,
  });

  // Pagination
  const pagination = usePagination({
    initialPageSize: 25,
  });
  const { resetPage } = pagination;

  // Tickets query with pagination
  const { data: ticketsData, isLoading: ticketsLoading, isFetching: ticketsFetching } = useQuery({
    queryKey: ['admin-support-tickets', filters, pagination.page, pagination.pageSize],
    queryFn: () => getAllTickets({
      ...filters,
      limit: pagination.pageSize,
      offset: pagination.offset,
    }),
    staleTime: 10000, // Consider data fresh for 10 seconds
    refetchInterval: 20000, // Reduced from 15s to 20s
  });

  // Update pagination total when data changes
  const totalCount = ticketsData?.totalCount || 0;
  const tickets = useMemo(() => ticketsData?.tickets ?? [], [ticketsData?.tickets]);

  // Dynamic refetch interval based on ticket status
  const messageRefetchInterval = useMemo(() => {
    if (!selectedTicket) return false;
    // Faster refresh if ticket is actively being worked on
    if (selectedTicket.status === 'in_progress') return 10000;
    return 20000;
  }, [selectedTicket]);

  // Messages query for selected ticket
  const { data: messages = [], isLoading: messagesLoading, isFetching: messagesFetching } = useQuery({
    queryKey: ['ticket-messages', selectedTicket?.id],
    queryFn: () => (selectedTicket ? getTicketMessages(selectedTicket.id) : Promise.resolve([])),
    enabled: !!selectedTicket,
    staleTime: 8000, // Consider messages fresh for 8 seconds
    refetchInterval: messageRefetchInterval,
  });

  // Mutations
  const assignMutation = useMutation({
    mutationFn: ({ ticketId, userId }: { ticketId: string; userId: string | null }) =>
      assignTicket(ticketId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-stats'] });
      toast.success('Ticket atribuído com sucesso');
    },
    onError: () => toast.error('Erro ao atribuir ticket'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: SupportStatus }) =>
      updateTicketStatus(ticketId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-stats'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const priorityMutation = useMutation({
    mutationFn: ({ ticketId, priority }: { ticketId: string; priority: SupportPriority }) =>
      updateTicketPriority(ticketId, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast.success('Prioridade atualizada');
    },
    onError: () => toast.error('Erro ao atualizar prioridade'),
  });

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      sendStaffMessage(ticketId, message),
    onSuccess: () => {
      setReplyMessage('');
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast.success('Resposta enviada');
    },
    onError: () => toast.error('Erro ao enviar resposta'),
  });

  const handleAssignToMe = (ticket: SupportTicket) => {
    if (user) {
      assignMutation.mutate({ ticketId: ticket.id, userId: user.id });
    }
  };

  const handleSendReply = () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    replyMutation.mutate({ ticketId: selectedTicket.id, message: replyMessage.trim() });
  };

  // Filter tickets by date locally
  const filteredTickets = useMemo(() => {
    let result = tickets;

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case 'today':
          startDate = startOfDay(now);
          break;
        case 'week':
          startDate = subDays(now, 7);
          break;
        case 'month':
          startDate = subDays(now, 30);
          break;
        default:
          startDate = new Date(0);
      }

      result = result.filter((ticket) => new Date(ticket.created_at) >= startDate);
    }

    return result;
  }, [tickets, dateFilter]);

  // Reset page when filters change
  useEffect(() => {
    resetPage();
  }, [filters, dateFilter, resetPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Headphones className="h-8 w-8" />
          Suporte
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie tickets de suporte dos usuários
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.open ?? '-'}</p>
                <p className="text-sm text-muted-foreground">Abertos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.in_progress ?? '-'}</p>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.waiting_customer ?? '-'}</p>
                <p className="text-sm text-muted-foreground">Aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.resolved_today ?? '-'}</p>
                <p className="text-sm text-muted-foreground">Resolvidos Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search Bar and Filter Toggle */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por assunto, usuário ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-muted-foreground">
                  <Trash2 className="h-4 w-4" />
                  Limpar filtros
                </Button>
              )}
            </div>

            {/* Active Filters Chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {debouncedSearch && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                    <Search className="h-3 w-3 mr-1" />
                    "{debouncedSearch}"
                    <button
                      onClick={() => setSearch('')}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.status && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                    Status: {STATUS_LABELS[filters.status]}
                    <button
                      onClick={() => removeFilter('status')}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.category && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                    Categoria: {CATEGORY_LABELS[filters.category]}
                    <button
                      onClick={() => removeFilter('category')}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.priority && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                    Prioridade: {PRIORITY_LABELS[filters.priority]}
                    <button
                      onClick={() => removeFilter('priority')}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.assignedTo && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                    {filters.assignedTo === 'unassigned' ? 'Não atribuído' : 'Meus tickets'}
                    <button
                      onClick={() => removeFilter('assignedTo')}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {dateFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    {DATE_FILTER_LABELS[dateFilter]}
                    <button
                      onClick={() => removeFilter('date')}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}

            {/* Collapsible Filters */}
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleContent className="pt-4 border-t">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <Select
                      value={filters.status || 'all'}
                      onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v === 'all' ? undefined : v as SupportStatus }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Categoria</label>
                    <Select
                      value={filters.category || 'all'}
                      onValueChange={(v) => setFilters((prev) => ({ ...prev, category: v === 'all' ? undefined : v as SupportCategory }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Prioridade</label>
                    <Select
                      value={filters.priority || 'all'}
                      onValueChange={(v) => setFilters((prev) => ({ ...prev, priority: v === 'all' ? undefined : v as SupportPriority }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Atribuição</label>
                    <Select
                      value={filters.assignedTo || 'all'}
                      onValueChange={(v) => setFilters((prev) => ({ ...prev, assignedTo: v === 'all' ? undefined : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="unassigned">Não atribuído</SelectItem>
                        {user && <SelectItem value={user.id}>Meus tickets</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Período</label>
                    <Select
                      value={dateFilter}
                      onValueChange={(v) => setDateFilter(v as DateFilter)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Qualquer data" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DATE_FILTER_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>
            {filteredTickets.length} ticket(s) na página • {totalCount} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Headphones className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum ticket encontrado</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Atribuído</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {ticket.subject}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{ticket.user_display_name || 'Sem nome'}</span>
                          <span className="text-xs text-muted-foreground">{ticket.user_email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANTS[ticket.priority]}>
                          {PRIORITY_LABELS[ticket.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[ticket.status]}>
                          {STATUS_LABELS[ticket.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ticket.assigned_name || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(ticket.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!ticket.assigned_to && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignToMe(ticket)}
                              disabled={assignMutation.isPending}
                            >
                              Assumir
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setSelectedTicket(ticket)}
                          >
                            Ver
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <TablePagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={totalCount}
                totalPages={Math.ceil(totalCount / pagination.pageSize) || 1}
                pageNumbers={pagination.pageNumbers}
                canPrevPage={pagination.canPrevPage}
                canNextPage={pagination.canNextPage}
                startItem={pagination.startItem}
                endItem={Math.min(pagination.endItem, totalCount)}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="truncate">{selectedTicket?.subject}</span>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANTS[selectedTicket?.status || 'open']}>
                  {STATUS_LABELS[selectedTicket?.status || 'open']}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Ticket Info */}
              <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg mb-4 shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground">Usuário</p>
                  <p className="text-sm font-medium">{selectedTicket.user_display_name || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">{selectedTicket.user_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <p className="text-sm">{CATEGORY_LABELS[selectedTicket.category]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prioridade</p>
                  <Select
                    value={selectedTicket.priority}
                    onValueChange={(v) => priorityMutation.mutate({ ticketId: selectedTicket.id, priority: v as SupportPriority })}
                  >
                    <SelectTrigger className="h-8 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(v) => statusMutation.mutate({ ticketId: selectedTicket.id, status: v as SupportStatus })}
                  >
                    <SelectTrigger className="h-8 w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 border rounded-lg p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-3',
                          message.is_staff ? 'flex-row-reverse' : 'flex-row'
                        )}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className={message.is_staff ? 'bg-primary text-primary-foreground' : ''}>
                            {message.is_staff ? <Headphones className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn('flex flex-col max-w-[75%]', message.is_staff ? 'items-end' : 'items-start')}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {message.is_staff ? 'Suporte' : message.sender_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(message.created_at), "dd/MM HH:mm")}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'rounded-lg px-4 py-2',
                              message.is_staff
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Reply */}
              {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                <div className="flex gap-2 pt-4 shrink-0">
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Digite sua resposta..."
                    className="min-h-[80px] resize-none"
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={!replyMessage.trim() || replyMutation.isPending}
                    className="shrink-0"
                  >
                    {replyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
