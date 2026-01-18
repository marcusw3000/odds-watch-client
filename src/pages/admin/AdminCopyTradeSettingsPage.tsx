import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings, DollarSign, Percent, Users, TrendingUp } from 'lucide-react';
import { useCopyTradeSettings, useUpdateCopyTradeSettings, useCopyTradeStats } from '@/hooks/useCopyTrade';

export default function AdminCopyTradeSettingsPage() {
  const { data: settings, isLoading: loadingSettings } = useCopyTradeSettings();
  const { data: stats, isLoading: loadingStats } = useCopyTradeStats();
  const updateSettings = useUpdateCopyTradeSettings();

  const [formData, setFormData] = useState({
    default_monthly_fee: 19.90,
    default_profit_share_percent: 10,
    default_trader_split: 50,
    min_trader_split: 30,
    max_trader_split: 70,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        default_monthly_fee: settings.default_monthly_fee,
        default_profit_share_percent: settings.default_profit_share_percent,
        default_trader_split: settings.default_trader_split,
        min_trader_split: settings.min_trader_split,
        max_trader_split: settings.max_trader_split,
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(formData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações de Copy Trade</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações globais do sistema de copy trade
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loadingStats ? '-' : stats?.approvedTraders}
                </p>
                <p className="text-sm text-muted-foreground">Traders Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Users className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loadingStats ? '-' : stats?.pendingTraders}
                </p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loadingStats ? '-' : stats?.activeSubscriptions}
                </p>
                <p className="text-sm text-muted-foreground">Assinaturas Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loadingStats ? '-' : formatCurrency(stats?.platformRevenue || 0)}
                </p>
                <p className="text-sm text-muted-foreground">Receita Plataforma</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações Globais
          </CardTitle>
          <CardDescription>
            Estas configurações são aplicadas como padrão para novos traders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Monthly Fee */}
          <div className="space-y-2">
            <Label htmlFor="monthly_fee" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Taxa Mensal Padrão
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="monthly_fee"
                type="number"
                step="0.01"
                min="0"
                value={formData.default_monthly_fee}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  default_monthly_fee: parseFloat(e.target.value) || 0 
                }))}
                className="max-w-[200px]"
              />
              <span className="text-sm text-muted-foreground">
                {formatCurrency(formData.default_monthly_fee)} / mês
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Valor cobrado mensalmente para seguir um trader
            </p>
          </div>

          {/* Profit Share Percent */}
          <div className="space-y-2">
            <Label htmlFor="profit_share" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Porcentagem do Lucro Compartilhado
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="profit_share"
                type="number"
                min="0"
                max="100"
                value={formData.default_profit_share_percent}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  default_profit_share_percent: parseInt(e.target.value) || 0 
                }))}
                className="max-w-[200px]"
              />
              <Badge variant="secondary">{formData.default_profit_share_percent}%</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Quanto do lucro do seguidor é dividido entre trader e plataforma
            </p>
          </div>

          {/* Revenue Split */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Divisão da Receita (Split)
            </Label>
            
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Trader recebe:</span>
                <Badge variant="default" className="text-lg px-3">
                  {formData.default_trader_split}%
                </Badge>
              </div>
              
              <Slider
                value={[formData.default_trader_split]}
                onValueChange={([value]) => setFormData(prev => ({ 
                  ...prev, 
                  default_trader_split: value 
                }))}
                min={formData.min_trader_split}
                max={formData.max_trader_split}
                step={5}
                className="my-4"
              />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Plataforma recebe:</span>
                <Badge variant="outline" className="text-lg px-3">
                  {100 - formData.default_trader_split}%
                </Badge>
              </div>

              <div className="pt-4 border-t border-border mt-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Exemplo:</strong> Se o lucro do seguidor for R$ 100 e a % compartilhada for {formData.default_profit_share_percent}%:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Comissão total: R$ {((100 * formData.default_profit_share_percent) / 100).toFixed(2)}</li>
                  <li>• Trader recebe: R$ {((100 * formData.default_profit_share_percent / 100) * formData.default_trader_split / 100).toFixed(2)}</li>
                  <li>• Plataforma: R$ {((100 * formData.default_profit_share_percent / 100) * (100 - formData.default_trader_split) / 100).toFixed(2)}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Split Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_split">Split Mínimo do Trader</Label>
              <Input
                id="min_split"
                type="number"
                min="0"
                max="100"
                value={formData.min_trader_split}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  min_trader_split: parseInt(e.target.value) || 0 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo que o trader pode receber
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_split">Split Máximo do Trader</Label>
              <Input
                id="max_split"
                type="number"
                min="0"
                max="100"
                value={formData.max_trader_split}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  max_trader_split: parseInt(e.target.value) || 0 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Máximo que o trader pode receber
              </p>
            </div>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleSave} 
              disabled={updateSettings.isPending}
              className="w-full sm:w-auto"
            >
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
