import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useAdminUsers, 
  useAdjustWalletBalance, 
  useManageUserRoles, 
  useBlockUser,
  useSendAdminWarning,
  useAdminUserDetails,
  type AdminUser,
  type AdminUsersFilters,
} from '@/hooks/useSecureData';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  Users, 
  Wallet as WalletIcon, 
  Plus, 
  Minus, 
  Search, 
  Mail, 
  User, 
  Loader2, 
  Shield, 
  ShieldCheck, 
  UserCheck,
  MoreHorizontal,
  Eye,
  Copy,
  AlertTriangle,
  Ban,
  Unlock,
  FileText,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react';

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: ShieldCheck, variant: 'destructive' as const, color: 'text-red-500' },
  moderator: { label: 'Moderador', icon: Shield, variant: 'default' as const, color: 'text-blue-500' },
  user: { label: 'Usuário', icon: UserCheck, variant: 'secondary' as const, color: 'text-muted-foreground' },
};

const WARNING_CATEGORIES = {
  warning: { label: 'Advertência', icon: '⚠️' },
  reminder: { label: 'Lembrete', icon: '📌' },
  alert: { label: 'Alerta', icon: '🚨' },
};

const PAGE_SIZES = [10, 20, 50, 100];

type SortField = 'display_name' | 'email' | 'balance_available' | 'balance_total' | 'updated_at' | 'created_at';

export function AdminUsersPage() {
  const { user } = useAuth();
  
  // Pagination and filters state
  const [filters, setFilters] = useState<AdminUsersFilters>({
    search: '',
    limit: 20,
    offset: 0,
    sortBy: 'updated_at',
    sortOrder: 'desc',
    filterBlocked: null,
    filterRole: null,
  });
  const [searchInput, setSearchInput] = useState('');

  // Adjustment dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Role management dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [pendingRoleChanges, setPendingRoleChanges] = useState<{ action: 'add' | 'remove'; role: string }[]>([]);

  // Block/Unblock dialog state
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockAction, setBlockAction] = useState<'block' | 'unblock'>('block');
  const [blockReason, setBlockReason] = useState('');

  // Warning dialog state
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [warningCategory, setWarningCategory] = useState<'warning' | 'reminder' | 'alert'>('warning');
  const [warningSendEmail, setWarningSendEmail] = useState(false);

  // Details sheet state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);

  // Use secure hooks
  const { data, isLoading, refetch } = useAdminUsers(filters);
  const users = data?.users ?? [];
  const pagination = data?.pagination ?? { total: 0, limit: 20, offset: 0, hasMore: false };
  
  const adjustBalance = useAdjustWalletBalance();
  const manageRoles = useManageUserRoles();
  const blockUser = useBlockUser();
  const sendWarning = useSendAdminWarning();
  const { data: userDetails, isLoading: detailsLoading } = useAdminUserDetails(detailsUserId);

  // Pagination calculations
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    const newOffset = (page - 1) * filters.limit!;
    setFilters(prev => ({ ...prev, offset: newOffset }));
  };

  const handlePageSizeChange = (size: string) => {
    setFilters(prev => ({ ...prev, limit: parseInt(size), offset: 0 }));
  };

  // Search handler
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput, offset: 0 }));
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      offset: 0,
    }));
  };

  // Filter handlers
  const handleBlockedFilter = (value: string) => {
    let filterBlocked: boolean | null = null;
    if (value === 'blocked') filterBlocked = true;
    if (value === 'active') filterBlocked = false;
    setFilters(prev => ({ ...prev, filterBlocked, offset: 0 }));
  };

  const handleRoleFilter = (value: string) => {
    setFilters(prev => ({ ...prev, filterRole: value === 'all' ? null : value, offset: 0 }));
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (filters.sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return filters.sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  // Adjustment functions
  const openAdjustDialog = (targetUser: AdminUser, type: 'add' | 'subtract') => {
    setSelectedUser(targetUser);
    setAdjustmentType(type);
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustDialogOpen(true);
  };

  const handleProceedToConfirm = () => {
    if (!adjustmentAmount || parseFloat(adjustmentAmount) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!adjustmentReason.trim()) {
      toast.error('Informe o motivo do ajuste');
      return;
    }
    setAdjustDialogOpen(false);
    setConfirmDialogOpen(true);
  };

  const handleConfirmAdjustment = async () => {
    if (!selectedUser) return;

    const amount = parseFloat(adjustmentAmount);
    const finalAmount = adjustmentType === 'add' ? amount : -amount;

    try {
      await adjustBalance.mutateAsync({
        walletId: selectedUser.id,
        amount: finalAmount,
        reason: adjustmentReason.trim(),
      });

      toast.success('Saldo ajustado com sucesso');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ajustar saldo');
    }

    setConfirmDialogOpen(false);
    setSelectedUser(null);
  };

  // Role management functions
  const openRoleDialog = (targetUser: AdminUser) => {
    setSelectedUser(targetUser);
    setSelectedRoles([...targetUser.roles]);
    setRoleDialogOpen(true);
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const isOwnAdminRole = (role: string) => {
    return role === 'admin' && selectedUser?.user_id === user?.id;
  };

  const calculateRoleChanges = () => {
    if (!selectedUser) return [];
    
    const changes: { action: 'add' | 'remove'; role: string }[] = [];
    const originalRoles = selectedUser.roles;

    selectedRoles.forEach(role => {
      if (!originalRoles.includes(role)) {
        changes.push({ action: 'add', role });
      }
    });

    originalRoles.forEach(role => {
      if (!selectedRoles.includes(role)) {
        changes.push({ action: 'remove', role });
      }
    });

    return changes;
  };

  const handleProceedToRoleConfirm = () => {
    const changes = calculateRoleChanges();
    if (changes.length === 0) {
      toast.info('Nenhuma alteração para salvar');
      return;
    }
    setPendingRoleChanges(changes);
    setRoleDialogOpen(false);
    setRoleConfirmOpen(true);
  };

  const handleConfirmRoleChanges = async () => {
    if (!selectedUser || pendingRoleChanges.length === 0) return;

    try {
      for (const change of pendingRoleChanges) {
        await manageRoles.mutateAsync({
          userId: selectedUser.user_id,
          action: change.action,
          role: change.role,
        });
      }

      toast.success('Roles atualizados com sucesso');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar roles');
    }

    setRoleConfirmOpen(false);
    setPendingRoleChanges([]);
    setSelectedUser(null);
  };

  // Block/Unblock functions
  const openBlockDialog = (targetUser: AdminUser, action: 'block' | 'unblock') => {
    setSelectedUser(targetUser);
    setBlockAction(action);
    setBlockReason('');
    setBlockDialogOpen(true);
  };

  const handleConfirmBlock = async () => {
    if (!selectedUser) return;

    if (blockAction === 'block' && !blockReason.trim()) {
      toast.error('Informe o motivo do bloqueio');
      return;
    }

    try {
      await blockUser.mutateAsync({
        userId: selectedUser.user_id,
        action: blockAction,
        reason: blockReason.trim() || undefined,
      });

      toast.success(blockAction === 'block' ? 'Usuário bloqueado' : 'Usuário desbloqueado');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar status');
    }

    setBlockDialogOpen(false);
    setSelectedUser(null);
  };

  // Warning functions
  const openWarningDialog = (targetUser: AdminUser) => {
    setSelectedUser(targetUser);
    setWarningMessage('');
    setWarningCategory('warning');
    setWarningSendEmail(false);
    setWarningDialogOpen(true);
  };

  const handleSendWarning = async () => {
    if (!selectedUser || !warningMessage.trim()) {
      toast.error('Informe a mensagem do aviso');
      return;
    }

    try {
      await sendWarning.mutateAsync({
        userId: selectedUser.user_id,
        message: warningMessage.trim(),
        category: warningCategory,
        sendEmail: warningSendEmail,
      });

      toast.success('Aviso enviado com sucesso');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar aviso');
    }

    setWarningDialogOpen(false);
    setSelectedUser(null);
  };

  // Details functions
  const openDetailsSheet = (targetUser: AdminUser) => {
    setDetailsUserId(targetUser.user_id);
    setDetailsOpen(true);
  };

  const RoleBadge = ({ role }: { role: string }) => {
    const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];
    if (!config) return <Badge variant="outline">{role}</Badge>;
    
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Usuários e Carteiras</h1>
          <p className="text-muted-foreground">
            Gerenciamento de usuários, saldos e permissões
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Buscar e Filtrar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por email, nome, ID ou role..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Status:</Label>
              <Select 
                value={filters.filterBlocked === true ? 'blocked' : filters.filterBlocked === false ? 'active' : 'all'}
                onValueChange={handleBlockedFilter}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="blocked">Bloqueados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Role:</Label>
              <Select 
                value={filters.filterRole || 'all'}
                onValueChange={handleRoleFilter}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderador</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Por página:</Label>
              <Select 
                value={String(filters.limit)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map(size => (
                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WalletIcon className="h-5 w-5" />
              Usuários ({pagination.total})
            </div>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="font-semibold -ml-3"
                    onClick={() => handleSort('display_name')}
                  >
                    Usuário
                    <SortIcon field="display_name" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="font-semibold -ml-3"
                    onClick={() => handleSort('email')}
                  >
                    Email
                    <SortIcon field="email" />
                  </Button>
                </TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="font-semibold -mr-3"
                    onClick={() => handleSort('balance_available')}
                  >
                    Saldo Disponível
                    <SortIcon field="balance_available" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Saldo Total</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="font-semibold -ml-3"
                    onClick={() => handleSort('updated_at')}
                  >
                    Última Atualização
                    <SortIcon field="updated_at" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((targetUser) => (
                <TableRow key={targetUser.id} className={targetUser.is_blocked ? 'bg-destructive/5' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium flex items-center gap-1">
                          {targetUser.display_name || 'Sem nome'}
                          {targetUser.is_blocked && (
                            <Badge variant="destructive" className="text-xs ml-1">
                              <Ban className="h-3 w-3 mr-1" />
                              Bloqueado
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {targetUser.user_id.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">
                        {targetUser.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {targetUser.roles.length > 0 ? (
                        targetUser.roles.map(role => (
                          <RoleBadge key={role} role={role} />
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhum</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-green-600">
                    {formatCurrency(targetUser.balance_available)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatCurrency(targetUser.balance_available + targetUser.balance_locked)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(targetUser.updated_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openDetailsSheet(targetUser)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(targetUser.user_id, 'ID')}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar ID
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(targetUser.email, 'Email')}>
                          <Mail className="h-4 w-4 mr-2" />
                          Copiar Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openRoleDialog(targetUser)}>
                          <Shield className="h-4 w-4 mr-2" />
                          Gerenciar Roles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAdjustDialog(targetUser, 'add')}>
                          <Plus className="h-4 w-4 mr-2" />
                          Creditar Saldo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAdjustDialog(targetUser, 'subtract')}>
                          <Minus className="h-4 w-4 mr-2" />
                          Debitar Saldo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openWarningDialog(targetUser)}>
                          <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                          Enviar Aviso
                        </DropdownMenuItem>
                        {targetUser.is_blocked ? (
                          <DropdownMenuItem onClick={() => openBlockDialog(targetUser, 'unblock')}>
                            <Unlock className="h-4 w-4 mr-2 text-green-500" />
                            Desbloquear
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => openBlockDialog(targetUser, 'block')}>
                            <Ban className="h-4 w-4 mr-2 text-red-500" />
                            Bloquear
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + users.length, pagination.total)} de {pagination.total} usuários
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1 px-2">
                  <span className="text-sm">Página</span>
                  <span className="font-medium">{currentPage}</span>
                  <span className="text-sm">de</span>
                  <span className="font-medium">{totalPages}</span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalhes do Usuário
            </SheetTitle>
            <SheetDescription>
              Informações completas e histórico do usuário
            </SheetDescription>
          </SheetHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : userDetails ? (
            <Tabs defaultValue="profile" className="mt-6">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="profile">Perfil</TabsTrigger>
                <TabsTrigger value="wallet">Carteira</TabsTrigger>
                <TabsTrigger value="contracts">Contratos</TabsTrigger>
                <TabsTrigger value="activity">Atividade</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4 mt-4">
                <div className="grid gap-4">
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nome</span>
                      <span className="font-medium">{userDetails.profile.display_name || userDetails.profile.full_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="font-mono text-sm">{userDetails.profile.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Telefone</span>
                      <span className="font-mono text-sm">{userDetails.profile.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">CPF</span>
                      <span className="font-mono text-sm">{userDetails.profile.cpf || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Perfil Público</span>
                      <Badge variant={userDetails.profile.is_public ? 'default' : 'secondary'}>
                        {userDetails.profile.is_public ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Criado em</span>
                      <span className="text-sm">{format(new Date(userDetails.profile.created_at), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                  </div>

                  {userDetails.profile.is_blocked && (
                    <div className="p-4 border border-destructive rounded-lg bg-destructive/5 space-y-2">
                      <div className="flex items-center gap-2 text-destructive font-medium">
                        <Ban className="h-4 w-4" />
                        Usuário Bloqueado
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <strong>Motivo:</strong> {userDetails.profile.blocked_reason || 'Não informado'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Bloqueado em:</strong> {userDetails.profile.blocked_at ? format(new Date(userDetails.profile.blocked_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                      </p>
                    </div>
                  )}

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3">Roles</h4>
                    <div className="flex flex-wrap gap-2">
                      {userDetails.roles.length > 0 ? (
                        userDetails.roles.map(role => <RoleBadge key={role} role={role} />)
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhum role atribuído</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3">Indicações</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{userDetails.referralStats.total}</p>
                        <p className="text-sm text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{userDetails.referralStats.activated}</p>
                        <p className="text-sm text-muted-foreground">Ativadas</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-yellow-600">{userDetails.referralStats.pending}</p>
                        <p className="text-sm text-muted-foreground">Pendentes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="wallet" className="space-y-4 mt-4">
                {userDetails.wallet ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Disponível</p>
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(userDetails.wallet.balance_available)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Bloqueado</p>
                            <p className="text-2xl font-bold text-yellow-600">
                              {formatCurrency(userDetails.wallet.balance_locked)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="border rounded-lg">
                      <div className="p-3 border-b bg-muted/50">
                        <h4 className="font-medium">Transações Recentes</h4>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-2">
                          {userDetails.ledgerEntries.length > 0 ? (
                            userDetails.ledgerEntries.slice(0, 20).map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between p-2 border rounded text-sm">
                                <div className="flex items-center gap-2">
                                  {entry.direction === 'CREDIT' ? (
                                    <Plus className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Minus className="h-4 w-4 text-red-500" />
                                  )}
                                  <span>{entry.ref_type}</span>
                                </div>
                                <div className="text-right">
                                  <p className={entry.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                                    {entry.direction === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(entry.created_at), 'dd/MM HH:mm')}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-muted-foreground py-8">Nenhuma transação</p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Carteira não encontrada</p>
                )}
              </TabsContent>

              <TabsContent value="contracts" className="space-y-4 mt-4">
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">{userDetails.contractStats.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <Clock className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                      <p className="text-2xl font-bold">{userDetails.contractStats.active}</p>
                      <p className="text-xs text-muted-foreground">Ativos</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                      <p className="text-2xl font-bold">{userDetails.contractStats.won}</p>
                      <p className="text-xs text-muted-foreground">Ganhos</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <XCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
                      <p className="text-2xl font-bold">{userDetails.contractStats.lost}</p>
                      <p className="text-xs text-muted-foreground">Perdidos</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-muted/50">
                    <h4 className="font-medium">Contratos Recentes</h4>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="p-3 space-y-2">
                      {userDetails.contracts.length > 0 ? (
                        userDetails.contracts.slice(0, 20).map((contract) => (
                          <div key={contract.id} className="p-3 border rounded space-y-1">
                            <p className="font-medium text-sm truncate">{contract.event_title}</p>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Badge variant={contract.outcome === 'YES' ? 'default' : 'secondary'}>
                                  {contract.outcome}
                                </Badge>
                                <span>{contract.quantity} contratos</span>
                              </div>
                              <Badge variant={
                                contract.status === 'WON' ? 'default' :
                                contract.status === 'LOST' ? 'destructive' : 'outline'
                              }>
                                {contract.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(contract.purchased_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-8">Nenhum contrato</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 mt-4">
                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-muted/50 flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <h4 className="font-medium">Notificações Recentes</h4>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="p-3 space-y-2">
                      {userDetails.notifications.length > 0 ? (
                        userDetails.notifications.map((notif) => (
                          <div key={notif.id} className={`p-2 border rounded text-sm ${notif.is_read ? 'opacity-60' : ''}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{notif.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(notif.created_at), 'dd/MM HH:mm')}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-4">Nenhuma notificação</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-muted/50 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <h4 className="font-medium">Histórico Administrativo</h4>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="p-3 space-y-2">
                      {userDetails.auditLogs.length > 0 ? (
                        userDetails.auditLogs.map((log) => (
                          <div key={log.id} className="p-2 border rounded text-sm">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">{log.action_type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(log.created_at), 'dd/MM HH:mm')}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-4">Nenhuma ação administrativa</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-center text-muted-foreground py-8">Usuário não encontrado</p>
          )}
        </SheetContent>
      </Sheet>

      {/* Block/Unblock Dialog */}
      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {blockAction === 'block' ? (
                <>
                  <Ban className="h-5 w-5 text-red-500" />
                  Bloquear Usuário
                </>
              ) : (
                <>
                  <Unlock className="h-5 w-5 text-green-500" />
                  Desbloquear Usuário
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {blockAction === 'block' 
                    ? 'O usuário não poderá acessar a plataforma enquanto estiver bloqueado.'
                    : 'O usuário poderá voltar a acessar a plataforma normalmente.'
                  }
                </p>
                
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedUser?.display_name}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedUser?.email}
                  </p>
                </div>

                {blockAction === 'block' && (
                  <div className="space-y-2">
                    <Label>Motivo do bloqueio *</Label>
                    <Textarea
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Informe o motivo do bloqueio..."
                      rows={3}
                    />
                  </div>
                )}

                {blockAction === 'unblock' && selectedUser?.blocked_reason && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <strong>Motivo original do bloqueio:</strong>
                    <p className="text-sm mt-1">{selectedUser.blocked_reason}</p>
                  </div>
                )}

                <p className="text-sm text-destructive font-medium">
                  Esta ação será registrada no log de auditoria.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmBlock}
              disabled={blockUser.isPending}
              className={blockAction === 'block' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {blockUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : blockAction === 'block' ? (
                'Bloquear'
              ) : (
                'Desbloquear'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning Dialog */}
      <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Enviar Aviso ao Usuário
            </DialogTitle>
            <DialogDescription>
              O usuário receberá uma notificação com sua mensagem
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <div className="bg-muted p-3 rounded space-y-1">
                <p className="font-medium">
                  {selectedUser?.display_name || 'Sem nome'}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {selectedUser?.email}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={warningCategory} 
                onValueChange={(v) => setWarningCategory(v as 'warning' | 'reminder' | 'alert')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WARNING_CATEGORIES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.icon} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                placeholder="Digite a mensagem para o usuário..."
                rows={4}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-email"
                checked={warningSendEmail}
                onCheckedChange={(checked) => setWarningSendEmail(checked === true)}
              />
              <label
                htmlFor="send-email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enviar também por email
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendWarning} disabled={sendWarning.isPending}>
              {sendWarning.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Aviso'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Management Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Gerenciar Permissões
            </DialogTitle>
            <DialogDescription>
              Configure as permissões de acesso para este usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <div className="bg-muted p-3 rounded space-y-1">
                <p className="font-medium">
                  {selectedUser?.display_name || 'Sem nome'}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {selectedUser?.email}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Permissões</Label>
              
              {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                const Icon = config.icon;
                const isChecked = selectedRoles.includes(role);
                const isDisabled = isOwnAdminRole(role) && isChecked;
                
                return (
                  <div
                    key={role}
                    className={`flex items-center space-x-3 p-3 rounded-lg border ${
                      isChecked ? 'border-primary bg-primary/5' : 'border-border'
                    } ${isDisabled ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      id={`role-${role}`}
                      checked={isChecked}
                      disabled={isDisabled}
                      onCheckedChange={() => handleRoleToggle(role)}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <label
                          htmlFor={`role-${role}`}
                          className="font-medium cursor-pointer"
                        >
                          {config.label}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {role === 'admin' && 'Acesso total ao painel administrativo'}
                          {role === 'moderator' && 'Pode moderar comentários e conteúdo'}
                          {role === 'user' && 'Permissões básicas de usuário'}
                        </p>
                      </div>
                    </div>
                    {isDisabled && (
                      <span className="text-xs text-muted-foreground">
                        (seu próprio admin)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleProceedToRoleConfirm}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Confirmation Dialog */}
      <AlertDialog open={roleConfirmOpen} onOpenChange={setRoleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alterações de Permissão</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Você está prestes a alterar as permissões do usuário:</p>
                
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedUser?.display_name}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedUser?.email}
                  </p>
                </div>

                <div className="space-y-2">
                  {pendingRoleChanges.map((change, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded ${
                        change.action === 'add' 
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                          : 'bg-red-500/10 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {change.action === 'add' ? (
                        <Plus className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      <span>
                        {change.action === 'add' ? 'Adicionar' : 'Remover'} role:{' '}
                        <strong>{ROLE_CONFIG[change.role as keyof typeof ROLE_CONFIG]?.label || change.role}</strong>
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-destructive font-medium">
                  Esta ação será registrada no log de auditoria.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRoleChanges}
              disabled={manageRoles.isPending}
            >
              {manageRoles.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Alterações'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === 'add' ? 'Creditar Saldo' : 'Debitar Saldo'}
            </DialogTitle>
            <DialogDescription>
              {adjustmentType === 'add' 
                ? 'Adicionar valor ao saldo disponível do usuário'
                : 'Remover valor do saldo disponível do usuário'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <div className="bg-muted p-3 rounded space-y-1">
                <p className="font-medium">
                  {selectedUser?.display_name || 'Sem nome'}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {selectedUser?.email}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  ID: {selectedUser?.user_id.substring(0, 8)}...
                </p>
              </div>
            </div>

            <div>
              <Label>Saldo Atual</Label>
              <p className="text-lg font-bold">
                {selectedUser && formatCurrency(selectedUser.balance_available)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Valor do Ajuste (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100000"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo do Ajuste *</Label>
              <Textarea
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Descreva o motivo do ajuste..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleProceedToConfirm}>
              Prosseguir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ajuste de Saldo</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Você está prestes a realizar o seguinte ajuste:</p>
                
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Tipo:</span>
                    <Badge variant={adjustmentType === 'add' ? 'default' : 'destructive'}>
                      {adjustmentType === 'add' ? 'CRÉDITO' : 'DÉBITO'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor:</span>
                    <span className="font-bold">
                      {adjustmentAmount && formatCurrency(parseFloat(adjustmentAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Novo Saldo:</span>
                    <span className="font-bold">
                      {selectedUser && adjustmentAmount && formatCurrency(
                        selectedUser.balance_available + 
                        (adjustmentType === 'add' ? 1 : -1) * parseFloat(adjustmentAmount)
                      )}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <strong>Motivo:</strong> {adjustmentReason}
                </div>

                <p className="text-sm text-destructive font-medium">
                  Esta ação será registrada no log de auditoria e não pode ser desfeita.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAdjustment}
              disabled={adjustBalance.isPending}
            >
              {adjustBalance.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Ajuste'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}