import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useAdminUsers, useAdjustWalletBalance, useManageUserRoles, type AdminUser } from '@/hooks/useSecureData';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Users, Wallet as WalletIcon, Plus, Minus, Search, Mail, User, Loader2, Shield, ShieldCheck, UserCheck } from 'lucide-react';

const ROLE_CONFIG = {
  admin: { label: 'Admin', icon: ShieldCheck, variant: 'destructive' as const, color: 'text-red-500' },
  moderator: { label: 'Moderador', icon: Shield, variant: 'default' as const, color: 'text-blue-500' },
  user: { label: 'Usuário', icon: UserCheck, variant: 'secondary' as const, color: 'text-muted-foreground' },
};

export function AdminUsersPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

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

  // Use secure hooks
  const { data: users = [], isLoading, refetch } = useAdminUsers(debouncedSearch);
  const adjustBalance = useAdjustWalletBalance();
  const manageRoles = useManageUserRoles();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleSearch = () => {
    setDebouncedSearch(searchTerm);
  };

  const openAdjustDialog = (user: AdminUser, type: 'add' | 'subtract') => {
    setSelectedUser(user);
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

    // Roles to add
    selectedRoles.forEach(role => {
      if (!originalRoles.includes(role)) {
        changes.push({ action: 'add', role });
      }
    });

    // Roles to remove
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
      // Process changes sequentially to maintain consistency
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

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.user_id.toLowerCase().includes(term) ||
      u.email_masked.toLowerCase().includes(term) ||
      u.display_name.toLowerCase().includes(term) ||
      u.roles.some(r => r.toLowerCase().includes(term))
    );
  });

  if (isLoading) {
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

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buscar Usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por email, nome, ID ou role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletIcon className="h-5 w-5" />
            Usuários ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Saldo Disponível</TableHead>
                <TableHead className="text-right">Saldo Total</TableHead>
                <TableHead>Última Atualização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((targetUser) => (
                <TableRow key={targetUser.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {targetUser.display_name || 'Sem nome'}
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
                        {targetUser.email_masked}
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
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRoleDialog(targetUser)}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Roles
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAdjustDialog(targetUser, 'add')}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAdjustDialog(targetUser, 'subtract')}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                  {selectedUser?.email_masked}
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
            <AlertDialogDescription className="space-y-4">
              <p>Você está prestes a alterar as permissões do usuário:</p>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedUser?.display_name}</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {selectedUser?.email_masked}
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
                  {selectedUser?.email_masked}
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
            <AlertDialogDescription className="space-y-4">
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
