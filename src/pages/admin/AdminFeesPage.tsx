import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinancialRepository } from '@/services/FinancialRepository';
import { FeeEngine } from '@/services/FeeEngine';
import { useAuth } from '@/hooks/useAuth';
import type { FeeRule, FeeType, FeeMode, FeeTier } from '@/types/financial';
import { Plus, Edit, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AdminFeesPage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FeeRule | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'DEPOSIT' as FeeType,
    mode: 'PERCENT' as FeeMode,
    percent_value: 0,
    flat_value: 0,
    min_fee: 0,
    max_fee: 0,
    tiers: [{ min: 0, max: 500, percent: 0.03 }] as FeeTier[],
    effective_from: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    const data = await FinancialRepository.getAllFeeRules();
    setRules(data);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'DEPOSIT',
      mode: 'PERCENT',
      percent_value: 0,
      flat_value: 0,
      min_fee: 0,
      max_fee: 0,
      tiers: [{ min: 0, max: 500, percent: 0.03 }],
      effective_from: new Date().toISOString().split('T')[0]
    });
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rule: FeeRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      mode: rule.mode,
      percent_value: rule.percent_value || 0,
      flat_value: rule.flat_value || 0,
      min_fee: rule.min_fee || 0,
      max_fee: rule.max_fee || 0,
      tiers: rule.tiers || [],
      effective_from: new Date(rule.effective_from).toISOString().split('T')[0]
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    const ruleData = {
      name: formData.name,
      type: formData.type,
      mode: formData.mode,
      percent_value: formData.mode === 'PERCENT' ? formData.percent_value : null,
      flat_value: formData.mode === 'FIXED' ? formData.flat_value : null,
      min_fee: formData.min_fee || null,
      max_fee: formData.max_fee || null,
      tiers: formData.mode === 'TIERED' ? formData.tiers : [],
      effective_from: new Date(formData.effective_from).toISOString(),
      is_active: true,
      created_by: user.id
    };

    try {
      if (editingRule) {
        // Get before state for audit
        const before = editingRule;
        
        const updated = await FinancialRepository.updateFeeRule(editingRule.id, ruleData);
        if (updated) {
          // Record audit log
          await FeeEngine.recordAuditLog({
            actorUserId: user.id,
            action: 'FEE_RULE_UPDATED',
            entity: 'fee_rules',
            entityId: editingRule.id,
            beforeData: before as unknown as Record<string, unknown>,
            afterData: updated as unknown as Record<string, unknown>
          });
          toast.success('Regra atualizada com sucesso');
        }
      } else {
        const created = await FinancialRepository.createFeeRule(ruleData);
        if (created) {
          // Record audit log
          await FeeEngine.recordAuditLog({
            actorUserId: user.id,
            action: 'FEE_RULE_CREATED',
            entity: 'fee_rules',
            entityId: created.id,
            afterData: created as unknown as Record<string, unknown>
          });
          toast.success('Regra criada com sucesso');
        }
      }
      setDialogOpen(false);
      loadRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Erro ao salvar regra');
    }
  };

  const handleToggleActive = async (rule: FeeRule) => {
    if (!user?.id) return;

    const newStatus = !rule.is_active;
    const updated = await FinancialRepository.updateFeeRule(rule.id, { is_active: newStatus });
    
    if (updated) {
      await FeeEngine.recordAuditLog({
        actorUserId: user.id,
        action: newStatus ? 'FEE_RULE_ACTIVATED' : 'FEE_RULE_DEACTIVATED',
        entity: 'fee_rules',
        entityId: rule.id,
        beforeData: { is_active: rule.is_active },
        afterData: { is_active: newStatus }
      });
      toast.success(newStatus ? 'Regra ativada' : 'Regra desativada');
      loadRules();
    }
  };

  const addTier = () => {
    const lastTier = formData.tiers[formData.tiers.length - 1];
    setFormData({
      ...formData,
      tiers: [...formData.tiers, { min: lastTier?.max || 0, max: null, percent: 0.01 }]
    });
  };

  const updateTier = (index: number, field: keyof FeeTier, value: number | null) => {
    const newTiers = [...formData.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setFormData({ ...formData, tiers: newTiers });
  };

  const removeTier = (index: number) => {
    setFormData({
      ...formData,
      tiers: formData.tiers.filter((_, i) => i !== index)
    });
  };

  const getModeLabel = (mode: FeeMode) => {
    switch (mode) {
      case 'PERCENT': return 'Percentual';
      case 'FIXED': return 'Fixo';
      case 'TIERED': return 'Escalonado';
    }
  };

  const getTypeLabel = (type: FeeType) => {
    switch (type) {
      case 'DEPOSIT': return 'Depósito';
      case 'WITHDRAW': return 'Saque';
      case 'TRADE': return 'Trade';
      case 'SETTLEMENT': return 'Liquidação';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Regras de Taxas</h1>
          <p className="text-muted-foreground">
            Gerencie as regras de cobrança de taxas da plataforma
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regras Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(rule.type)}</Badge>
                  </TableCell>
                  <TableCell>{getModeLabel(rule.mode)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                      {rule.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(rule.effective_from), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(rule)}
                    >
                      <Power className={`h-4 w-4 ${rule.is_active ? 'text-green-500' : 'text-gray-400'}`} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma regra cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regra' : 'Nova Regra de Taxa'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Taxa de Depósito Padrão"
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Vigência</Label>
                <Input
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Operação</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as FeeType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEPOSIT">Depósito</SelectItem>
                    <SelectItem value="WITHDRAW">Saque</SelectItem>
                    <SelectItem value="TRADE">Trade</SelectItem>
                    <SelectItem value="SETTLEMENT">Liquidação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modo de Cobrança</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(v) => setFormData({ ...formData, mode: v as FeeMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentual</SelectItem>
                    <SelectItem value="FIXED">Valor Fixo</SelectItem>
                    <SelectItem value="TIERED">Escalonado (Tiers)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mode-specific fields */}
            {formData.mode === 'PERCENT' && (
              <div className="space-y-2">
                <Label>Percentual (%)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.percent_value * 100}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    percent_value: parseFloat(e.target.value) / 100 
                  })}
                  placeholder="Ex: 1.5"
                />
                <p className="text-xs text-muted-foreground">
                  Exemplo: 1.5 = 1.5%
                </p>
              </div>
            )}

            {formData.mode === 'FIXED' && (
              <div className="space-y-2">
                <Label>Valor Fixo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.flat_value}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    flat_value: parseFloat(e.target.value) 
                  })}
                  placeholder="Ex: 5.00"
                />
              </div>
            )}

            {formData.mode === 'TIERED' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Faixas de Valor</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addTier}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Faixa
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {formData.tiers.map((tier, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <div className="flex-1">
                        <Label className="text-xs">Mínimo (R$)</Label>
                        <Input
                          type="number"
                          value={tier.min}
                          onChange={(e) => updateTier(index, 'min', parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Máximo (R$)</Label>
                        <Input
                          type="number"
                          value={tier.max || ''}
                          placeholder="Sem limite"
                          onChange={(e) => updateTier(index, 'max', e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Taxa (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={tier.percent * 100}
                          onChange={(e) => updateTier(index, 'percent', parseFloat(e.target.value) / 100)}
                        />
                      </div>
                      {formData.tiers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          onClick={() => removeTier(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taxa Mínima (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.min_fee}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    min_fee: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa Máxima (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_fee}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    max_fee: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="0.00 (sem limite)"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingRule ? 'Salvar Alterações' : 'Criar Regra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
