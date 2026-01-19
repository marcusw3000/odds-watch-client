import { useEffect, useState } from 'react';
import { Gift, Users, TrendingUp, Percent, Settings, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ReferralService } from '@/services/ReferralService';
import type { ReferralSettings, AdminReferralStats, ReferralWithDetails } from '@/types/referral';

export function AdminReferralsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [stats, setStats] = useState<AdminReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralWithDetails[]>([]);
  
  // Form state
  const [isActive, setIsActive] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState('10');
  const [discountPercent, setDiscountPercent] = useState('50');
  const [discountDays, setDiscountDays] = useState('30');
  const [minDeposit, setMinDeposit] = useState('50');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsData, statsData, referralsData] = await Promise.all([
        ReferralService.getSettings(),
        ReferralService.getAdminStats(),
        ReferralService.getAllReferrals()
      ]);
      
      setSettings(settingsData);
      setStats(statsData);
      setReferrals(referralsData);
      
      if (settingsData) {
        setIsActive(settingsData.is_active);
        setCommissionPercent((settingsData.default_commission_percent * 100).toString());
        setDiscountPercent((settingsData.default_discount_percent * 100).toString());
        setDiscountDays(settingsData.discount_duration_days.toString());
        setMinDeposit(settingsData.min_deposit_amount.toString());
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados de indicação',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { success, error } = await ReferralService.updateSettings({
        is_active: isActive,
        default_commission_percent: parseFloat(commissionPercent) / 100,
        default_discount_percent: parseFloat(discountPercent) / 100,
        discount_duration_days: parseInt(discountDays),
        min_deposit_amount: parseFloat(minDeposit)
      }, user.id);
      
      if (error) {
        toast({
          title: 'Erro',
          description: error,
          variant: 'destructive'
        });
        return;
      }
      
      toast({
        title: 'Sucesso',
        description: 'Configurações atualizadas com sucesso'
      });
      
      loadData();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVATED':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-muted text-muted-foreground">Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sistema de Indicação</h1>
          <p className="text-muted-foreground">
            Gerencie o programa de indicação e acompanhe métricas
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Códigos Gerados</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCodes ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicações Ativadas</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.totalActivated ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {(stats?.conversionRate ?? 0).toFixed(2)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Pagas</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats?.totalCommissionsPaid ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Sistema
          </CardTitle>
          <CardDescription>
            Configure os parâmetros do programa de indicação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Sistema Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Habilita ou desabilita novas indicações
              </p>
            </div>
            <Switch 
              checked={isActive} 
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Settings Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="commission">Comissão do Indicador (%)</Label>
              <Input
                id="commission"
                type="number"
                min="0"
                max="100"
                step="1"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                % da taxa que vai para o indicador
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount">Desconto do Indicado (%)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                max="100"
                step="1"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                % de desconto na taxa para o indicado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">Duração do Desconto (dias)</Label>
              <Input
                id="days"
                type="number"
                min="1"
                max="365"
                value={discountDays}
                onChange={(e) => setDiscountDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Por quantos dias o desconto vale
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minDeposit">Depósito Mínimo (R$)</Label>
              <Input
                id="minDeposit"
                type="number"
                min="0"
                step="10"
                value={minDeposit}
                onChange={(e) => setMinDeposit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo para ativar a indicação
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Indicações</CardTitle>
          <CardDescription>
            Lista completa de indicações do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma indicação registrada ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Indicador</TableHead>
                    <TableHead>Indicado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comissão %</TableHead>
                    <TableHead>Desconto %</TableHead>
                    <TableHead className="text-right">Total Ganho</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-mono font-medium">
                        {referral.referral_code}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {referral.referrer_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {referral.referred_id 
                          ? `${referral.referred_id.substring(0, 8)}...` 
                          : <span className="text-yellow-500">Aguardando</span>
                        }
                      </TableCell>
                      <TableCell>{getStatusBadge(referral.status)}</TableCell>
                      <TableCell>{(referral.commission_percent * 100).toFixed(2)}%</TableCell>
                      <TableCell>{(referral.discount_percent * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(referral.total_commission_earned)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(referral.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
