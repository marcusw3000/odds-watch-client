import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useAdminUsers, useAdjustWalletBalance, type AdminUser } from '@/hooks/useSecureData';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Users, Wallet as WalletIcon, Plus, Minus, Search, Mail, User, Loader2 } from 'lucide-react';

export function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Adjustment dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Use secure hooks
  const { data: users = [], isLoading, refetch } = useAdminUsers(debouncedSearch);
  const adjustBalance = useAdjustWalletBalance();

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

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.user_id.toLowerCase().includes(term) ||
      u.email_masked.toLowerCase().includes(term) ||
      u.display_name.toLowerCase().includes(term)
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
            Gerenciamento de usuários e ajustes de saldo
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
                placeholder="Buscar por email, nome ou ID..."
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
            Carteiras ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Saldo Disponível</TableHead>
                <TableHead className="text-right">Saldo Bloqueado</TableHead>
                <TableHead className="text-right">Saldo Total</TableHead>
                <TableHead>Moeda</TableHead>
                <TableHead>Última Atualização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {user.display_name || 'Sem nome'}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {user.user_id.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">
                        {user.email_masked}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-green-600">
                    {formatCurrency(user.balance_available)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-600">
                    {formatCurrency(user.balance_locked)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatCurrency(user.balance_available + user.balance_locked)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.currency}</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.updated_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAdjustDialog(user, 'add')}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Creditar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAdjustDialog(user, 'subtract')}
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Debitar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma carteira encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      {/* Confirmation Dialog */}
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