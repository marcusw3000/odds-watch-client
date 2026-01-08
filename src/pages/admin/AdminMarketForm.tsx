import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminDataProvider } from '@/services/AdminDataProvider';
import { MarketFormData } from '@/types/admin';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LMSRConfigurator } from '@/components/admin/LMSRConfigurator';
import { StatusController } from '@/components/admin/StatusController';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

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

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isEditing ? 'Editar Mercado' : 'Novo Mercado'}</h1>
      
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Informações Básicas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Título</Label><Input value={formData.title} onChange={(e) => updateField('title', e.target.value)} required /></div>
              <div><Label>Categoria</Label><Input value={formData.category} onChange={(e) => updateField('category', e.target.value)} required /></div>
              <div><Label>Descrição</Label><Textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)} /></div>
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
