import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, 
  Check, 
  X, 
  Pause, 
  Play, 
  Settings, 
  Users,
  TrendingUp,
  DollarSign,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useCopyTraders, 
  useManageCopyTrader, 
  useUpdateTraderSettings,
  useCopyTradeSettings 
} from '@/hooks/useCopyTrade';
import type { CopyTrader, CopyTraderStatus } from '@/types/copyTrade';

const statusConfig: Record<CopyTraderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'secondary' },
  APPROVED: { label: 'Aprovado', variant: 'default' },
  SUSPENDED: { label: 'Suspenso', variant: 'destructive' },
  REJECTED: { label: 'Rejeitado', variant: 'outline' },
};

export default function AdminCopyTradersPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedTrader, setSelectedTrader] = useState<CopyTrader | null>(null);
  const [dialogType, setDialogType] = useState<'approve' | 'reject' | 'settings' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [useCustomSplit, setUseCustomSplit] = useState(false);
  const [traderSettings, setTraderSettings] = useState({
    monthly_fee: 19.90,
    profit_share_percent: 10,
    custom_trader_split: 50,
  });

  const { data: settings } = useCopyTradeSettings();
  const { data: traders, isLoading } = useCopyTraders(activeTab === 'all' ? undefined : activeTab.toUpperCase());
  const manageTrader = useManageCopyTrader();
  const updateSettings = useUpdateTraderSettings();

  const openApproveDialog = (trader: CopyTrader) => {
    setSelectedTrader(trader);
    setTraderSettings({
      monthly_fee: trader.monthly_fee ?? settings?.default_monthly_fee ?? 19.90,
      profit_share_percent: trader.profit_share_percent ?? settings?.default_profit_share_percent ?? 10,
      custom_trader_split: trader.custom_trader_split ?? settings?.default_trader_split ?? 50,
    });
    setUseCustomSplit(trader.custom_trader_split != null);
    setDialogType('approve');
  };

  const openRejectDialog = (trader: CopyTrader) => {
    setSelectedTrader(trader);
    setRejectionReason('');
    setDialogType('reject');
  };

  const openSettingsDialog = (trader: CopyTrader) => {
    setSelectedTrader(trader);
    setTraderSettings({
      monthly_fee: trader.monthly_fee ?? settings?.default_monthly_fee ?? 19.90,
      profit_share_percent: trader.profit_share_percent ?? settings?.default_profit_share_percent ?? 10,
      custom_trader_split: trader.custom_trader_split ?? settings?.default_trader_split ?? 50,
    });
    setUseCustomSplit(trader.custom_trader_split != null);
    setDialogType('settings');
  };

  const handleApprove = () => {
    if (!selectedTrader) return;
    
    manageTrader.mutate({
      action: 'approve',
      trader_id: selectedTrader.id,
      monthly_fee: traderSettings.monthly_fee,
      profit_share_percent: traderSettings.profit_share_percent,
      custom_trader_split: useCustomSplit ? traderSettings.custom_trader_split : undefined,
    }, {
      onSuccess: () => {
        setDialogType(null);
        setSelectedTrader(null);
      },
    });
  };

  const handleReject = () => {
    if (!selectedTrader) return;
    
    manageTrader.mutate({
      action: 'reject',
      trader_id: selectedTrader.id,
      rejection_reason: rejectionReason,
    }, {
      onSuccess: () => {
        setDialogType(null);
        setSelectedTrader(null);
      },
    });
  };

  const handleSaveSettings = () => {
    if (!selectedTrader) return;
    
    updateSettings.mutate({
      trader_id: selectedTrader.id,
      monthly_fee: traderSettings.monthly_fee,
      profit_share_percent: traderSettings.profit_share_percent,
      custom_trader_split: useCustomSplit ? traderSettings.custom_trader_split : null,
    }, {
      onSuccess: () => {
        setDialogType(null);
        setSelectedTrader(null);
      },
    });
  };

  const handleSuspend = (trader: CopyTrader) => {
    manageTrader.mutate({
      action: 'suspend',
      trader_id: trader.id,
    });
  };

  const handleUnsuspend = (trader: CopyTrader) => {
    manageTrader.mutate({
      action: 'unsuspend',
      trader_id: trader.id,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerenciar Copy Traders</h1>
        <p className="text-muted-foreground">
          Aprovar, rejeitar ou suspender influenciadores que querem ser copiados
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovados</TabsTrigger>
          <TabsTrigger value="suspended">Suspensos</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Copy Traders</CardTitle>
              <CardDescription>
                {traders?.length || 0} trader(s) encontrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : traders?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum trader encontrado nesta categoria
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trader</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Seguidores</TableHead>
                      <TableHead>Trades Copiados</TableHead>
                      <TableHead>Ganhos</TableHead>
                      <TableHead>Split</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {traders?.map((trader) => (
                      <TableRow key={trader.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={trader.avatar_url || undefined} />
                              <AvatarFallback>
                                {trader.display_name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{trader.display_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {trader.profile?.email || 'Email não disponível'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusConfig[trader.status].variant}>
                            {statusConfig[trader.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {trader.total_followers}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            {trader.total_trades_copied}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {formatCurrency(trader.total_earnings)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {trader.custom_trader_split != null ? (
                            <Badge variant="outline">
                              {trader.custom_trader_split}/{trader.custom_platform_split}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Padrão</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {format(new Date(trader.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {trader.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => openApproveDialog(trader)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openRejectDialog(trader)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Rejeitar
                                </Button>
                              </>
                            )}
                            {trader.status === 'APPROVED' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openSettingsDialog(trader)}
                                >
                                  <Settings className="h-4 w-4 mr-1" />
                                  Config
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleSuspend(trader)}
                                  disabled={manageTrader.isPending}
                                >
                                  <Pause className="h-4 w-4 mr-1" />
                                  Suspender
                                </Button>
                              </>
                            )}
                            {trader.status === 'SUSPENDED' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleUnsuspend(trader)}
                                disabled={manageTrader.isPending}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Reativar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={dialogType === 'approve'} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar Copy Trader</DialogTitle>
            <DialogDescription>
              Configure as taxas para {selectedTrader?.display_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Taxa Mensal</Label>
              <Input
                type="number"
                step="0.01"
                value={traderSettings.monthly_fee}
                onChange={(e) => setTraderSettings(prev => ({
                  ...prev,
                  monthly_fee: parseFloat(e.target.value) || 0,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>% do Lucro Compartilhado</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={traderSettings.profit_share_percent}
                onChange={(e) => setTraderSettings(prev => ({
                  ...prev,
                  profit_share_percent: parseInt(e.target.value) || 0,
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Usar Split Customizado</Label>
              <Switch
                checked={useCustomSplit}
                onCheckedChange={setUseCustomSplit}
              />
            </div>

            {useCustomSplit && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Trader: {traderSettings.custom_trader_split}%</span>
                  <span>Plataforma: {100 - traderSettings.custom_trader_split}%</span>
                </div>
                <Slider
                  value={[traderSettings.custom_trader_split]}
                  onValueChange={([value]) => setTraderSettings(prev => ({
                    ...prev,
                    custom_trader_split: value,
                  }))}
                  min={settings?.min_trader_split ?? 30}
                  max={settings?.max_trader_split ?? 70}
                  step={5}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={manageTrader.isPending}>
              {manageTrader.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={dialogType === 'reject'} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Copy Trader</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição para {selectedTrader?.display_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label>Motivo da Rejeição</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explique o motivo da rejeição..."
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={manageTrader.isPending}
            >
              {manageTrader.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={dialogType === 'settings'} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Trader</DialogTitle>
            <DialogDescription>
              Edite as taxas de {selectedTrader?.display_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Taxa Mensal</Label>
              <Input
                type="number"
                step="0.01"
                value={traderSettings.monthly_fee}
                onChange={(e) => setTraderSettings(prev => ({
                  ...prev,
                  monthly_fee: parseFloat(e.target.value) || 0,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>% do Lucro Compartilhado</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={traderSettings.profit_share_percent}
                onChange={(e) => setTraderSettings(prev => ({
                  ...prev,
                  profit_share_percent: parseInt(e.target.value) || 0,
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Usar Split Customizado</Label>
              <Switch
                checked={useCustomSplit}
                onCheckedChange={setUseCustomSplit}
              />
            </div>

            {useCustomSplit && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Trader: {traderSettings.custom_trader_split}%</span>
                  <span>Plataforma: {100 - traderSettings.custom_trader_split}%</span>
                </div>
                <Slider
                  value={[traderSettings.custom_trader_split]}
                  onValueChange={([value]) => setTraderSettings(prev => ({
                    ...prev,
                    custom_trader_split: value,
                  }))}
                  min={settings?.min_trader_split ?? 30}
                  max={settings?.max_trader_split ?? 70}
                  step={5}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
