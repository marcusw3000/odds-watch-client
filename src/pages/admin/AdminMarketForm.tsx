import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminDataProvider } from '@/services/AdminDataProvider';
import { MarketFormData } from '@/types/admin';
import { MarketEvent, SettlementType, SETTLEMENT_TYPE_LABELS, OPERATOR_LABELS, SETTLEMENT_TYPE_UNITS, SettlementConfig } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LMSRConfigurator } from '@/components/admin/LMSRConfigurator';
import { StatusController } from '@/components/admin/StatusController';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Zap, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function AdminMarketForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [market, setMarket] = useState<MarketEvent | null>(null);
  
  const [formData, setFormData] = useState<MarketFormData>({
    title: '', category: '', description: '', settlementRules: [''],
    expiryAt: new Date(), tradingHaltAt: new Date(), eventAt: new Date(),
    limits: { minBuy: 10, maxBuy: 5000 }, initialYesOdds: 50, liquidity: 100,
    settlementType: 'MANUAL',
    settlementConfig: undefined,
  });

  useEffect(() => {
    if (isEditing && id) {
      AdminDataProvider.getMarket(id).then((m) => {
        if (m) {
          setMarket(m);
          setFormData({
            title: m.title, category: m.category, description: m.description || '',
            settlementRules: m.settlementRules || [''], expiryAt: m.expiryAt,
            tradingHaltAt: m.tradingHaltAt, eventAt: m.eventAt, limits: m.limits,
            initialYesOdds: m.outcomes.YES.price, liquidity: m.lmsr.b,
            settlementType: m.settlementType || 'MANUAL',
            settlementConfig: m.settlementConfig,
          });
        }
        setLoading(false);
      });
    }
  }, [id, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing && id) {
        await AdminDataProvider.updateMarket(id, formData);
        toast.success('Mercado atualizado!');
      } else {
        await AdminDataProvider.createMarket(formData);
        toast.success('Mercado criado!');
        navigate('/admin/markets');
      }
    } catch { toast.error('Erro ao salvar'); }
    setSaving(false);
  };

  const updateField = <K extends keyof MarketFormData>(key: K, value: MarketFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const addRule = () => updateField('settlementRules', [...formData.settlementRules, '']);
  const removeRule = (i: number) => updateField('settlementRules', formData.settlementRules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, val: string) => {
    const rules = [...formData.settlementRules];
    rules[i] = val;
    updateField('settlementRules', rules);
  };

  const updateSettlementConfig = (field: keyof SettlementConfig, value: string | number) => {
    const current = formData.settlementConfig || { threshold: 0, operator: 'lt' as const };
    updateField('settlementConfig', { ...current, [field]: value });
  };

  const isAutomatic = formData.settlementType !== 'MANUAL';

  const getThresholdLabel = () => {
    const unitInfo = SETTLEMENT_TYPE_UNITS[formData.settlementType];
    return unitInfo?.unit ? `Valor (${unitInfo.unit})` : 'Valor';
  };

  const getThresholdPlaceholder = () => {
    return SETTLEMENT_TYPE_UNITS[formData.settlementType]?.placeholder || '0';
  };

  const getUnitSuffix = () => {
    const unitInfo = SETTLEMENT_TYPE_UNITS[formData.settlementType];
    return unitInfo?.unit || '';
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{isEditing ? 'Editar Mercado' : 'Novo Mercado'}</h1>
        {isAutomatic && (
          <Badge variant="secondary" className="gap-1">
            <Bot className="h-3 w-3" />
            Automático
          </Badge>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Informações Básicas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Título</Label><Input value={formData.title} onChange={(e) => updateField('title', e.target.value)} required /></div>
              <div><Label>Categoria</Label><Input value={formData.category} onChange={(e) => updateField('category', e.target.value)} required /></div>
              <div><Label>Descrição</Label><Textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Tipo de Liquidação</CardTitle>
                <Zap className="h-4 w-4 text-warning" />
              </div>
              <CardDescription>
                Escolha se a liquidação será manual ou automática via API do BCB
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Fonte de Dados</Label>
                <Select 
                  value={formData.settlementType} 
                  onValueChange={(v) => {
                    updateField('settlementType', v as SettlementType);
                    if (v !== 'MANUAL' && !formData.settlementConfig) {
                      updateField('settlementConfig', { threshold: 0, operator: 'lt' });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SETTLEMENT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                        {key !== 'MANUAL' && <span className="ml-2 text-xs text-muted-foreground">(BCB API)</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isAutomatic && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Condição</Label>
                      <Select 
                        value={formData.settlementConfig?.operator || 'lt'} 
                        onValueChange={(v) => updateSettlementConfig('operator', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{getThresholdLabel()}</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={formData.settlementConfig?.threshold || ''} 
                        onChange={(e) => updateSettlementConfig('threshold', parseFloat(e.target.value) || 0)}
                        placeholder={getThresholdPlaceholder()}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">Condição de liquidação:</p>
                    <p className="text-muted-foreground">
                      O mercado será liquidado como <strong>SIM</strong> se {SETTLEMENT_TYPE_LABELS[formData.settlementType]} for{' '}
                      <strong>{OPERATOR_LABELS[formData.settlementConfig?.operator || 'lt']}</strong>{' '}
                      <strong>{getUnitSuffix() === 'R$' ? 'R$ ' : ''}{formData.settlementConfig?.threshold || 0}{getUnitSuffix() === '%' ? '%' : ''}</strong>
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Regras de Liquidação</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {formData.settlementRules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={rule} onChange={(e) => updateRule(i, e.target.value)} placeholder={`Regra ${i + 1}`} />
                  {formData.settlementRules.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeRule(i)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addRule}><Plus className="mr-2 h-4 w-4" />Adicionar Regra</Button>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Datas e Limites</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div><Label>Data do Evento</Label><Input type="datetime-local" value={formData.eventAt.toISOString().slice(0, 16)} onChange={(e) => updateField('eventAt', new Date(e.target.value))} /></div>
              <div><Label>Trading Halt</Label><Input type="datetime-local" value={formData.tradingHaltAt.toISOString().slice(0, 16)} onChange={(e) => updateField('tradingHaltAt', new Date(e.target.value))} /></div>
              <div><Label>Compra Mínima (R$)</Label><Input type="number" value={formData.limits.minBuy} onChange={(e) => updateField('limits', { ...formData.limits, minBuy: +e.target.value })} /></div>
              <div><Label>Compra Máxima (R$)</Label><Input type="number" value={formData.limits.maxBuy} onChange={(e) => updateField('limits', { ...formData.limits, maxBuy: +e.target.value })} /></div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <LMSRConfigurator initialYesOdds={formData.initialYesOdds} liquidity={formData.liquidity} onYesOddsChange={(v) => updateField('initialYesOdds', v)} onLiquidityChange={(v) => updateField('liquidity', v)} />
          
          {isEditing && market && (
            <StatusController
              market={market}
              onForceHalt={async (r) => { await AdminDataProvider.forceHalt(id!, r); setMarket(await AdminDataProvider.getMarket(id!) || market); toast.success('Halt aplicado'); }}
              onResumeTrading={async () => { await AdminDataProvider.resumeTrading(id!); setMarket(await AdminDataProvider.getMarket(id!) || market); toast.success('Trading retomado'); }}
              onSubmitResult={async (res, src) => { await AdminDataProvider.submitResult(id!, res, src); setMarket(await AdminDataProvider.getMarket(id!) || market); toast.success('Resultado submetido'); }}
              onExecuteSettlement={async () => { await AdminDataProvider.executeSettlement(id!); setMarket(await AdminDataProvider.getMarket(id!) || market); toast.success('Mercado liquidado'); }}
              onRevertResult={async () => { await AdminDataProvider.revertResult(id!); setMarket(await AdminDataProvider.getMarket(id!) || market); toast.success('Resultado revertido'); }}
            />
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Mercado'}
          </Button>
        </div>
      </form>
    </div>
  );
}
