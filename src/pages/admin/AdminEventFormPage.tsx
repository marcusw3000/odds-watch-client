import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Info, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminRepository } from '@/services/AdminRepository';
import { 
  MarketEvent, 
  EventFormData, 
  EVENT_CATEGORIES, 
  ResolutionSourceType,
  OddsMode,
  SpreadPolicy 
} from '@/types/admin';
import { ImageEditor } from '@/components/admin/ImageEditor';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AdminEventFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [expiryAt, setExpiryAt] = useState<Date | undefined>();
  
  // Resolution Source
  const [sourceType, setSourceType] = useState<ResolutionSourceType>('MANUAL');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceRule, setSourceRule] = useState('');
  
  // Odds
  const [oddsMode, setOddsMode] = useState<OddsMode>('MANUAL_PROBABILITY');
  const [spreadPolicy, setSpreadPolicy] = useState<SpreadPolicy>('AUTO_COMPLEMENT');
  const [oddsYes, setOddsYes] = useState(50);
  const [oddsNo, setOddsNo] = useState(50);
  const [oddsChangeReason, setOddsChangeReason] = useState('');

  // Image state
  const [imageData, setImageData] = useState<{ url: string; zoom: number; position: { x: number; y: number } }>({
    url: '',
    zoom: 1,
    position: { x: 50, y: 50 },
  });

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      const eventData = AdminRepository.getEvent(id);
      if (eventData) {
        setEvent(eventData);
        setTitle(eventData.title);
        setDescription(eventData.description);
        setCategory(eventData.category);
        setExpiryAt(eventData.expiryAt);
        setSourceType(eventData.resolutionSource.type);
        setSourceName(eventData.resolutionSource.name);
        setSourceUrl(eventData.resolutionSource.url);
        setSourceRule(eventData.resolutionSource.rule);
        setOddsMode(eventData.oddsConfig.mode);
        setSpreadPolicy(eventData.oddsConfig.spreadPolicy);
        setOddsYes(eventData.odds.yes);
        setOddsNo(eventData.odds.no);
      } else {
        navigate('/admin/events');
      }
    }
  }, [id, navigate]);

  // Auto-calculate complement
  useEffect(() => {
    if (spreadPolicy === 'AUTO_COMPLEMENT') {
      setOddsNo(100 - oddsYes);
    }
  }, [oddsYes, spreadPolicy]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Título é obrigatório';
    if (!description.trim()) newErrors.description = 'Descrição é obrigatória';
    if (!category) newErrors.category = 'Categoria é obrigatória';
    if (!expiryAt) newErrors.expiryAt = 'Data de expiração é obrigatória';
    if (!sourceName.trim()) newErrors.sourceName = 'Nome da fonte é obrigatório';
    if (!sourceUrl.trim()) newErrors.sourceUrl = 'URL da fonte é obrigatória';
    if (!sourceRule.trim()) newErrors.sourceRule = 'Regra de resolução é obrigatória';
    if (!imageData.url) newErrors.image = 'Imagem é obrigatória';
    
    if (oddsYes < 1 || oddsYes > 99) newErrors.oddsYes = 'Odds SIM deve estar entre 1 e 99';
    if (oddsNo < 1 || oddsNo > 99) newErrors.oddsNo = 'Odds NÃO deve estar entre 1 e 99';
    
    const total = oddsYes + oddsNo;
    if (total < 98 || total > 102) {
      newErrors.oddsTotal = 'A soma das odds deve ser aproximadamente 100';
    }

    // If editing and odds changed, require reason
    if (isEditing && event && (oddsYes !== event.odds.yes || oddsNo !== event.odds.no)) {
      if (!oddsChangeReason.trim()) {
        newErrors.oddsChangeReason = 'Motivo da alteração é obrigatório';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    setLoading(true);

    const formData: EventFormData = {
      title,
      description,
      category,
      expiryAt: expiryAt!,
      resolutionSource: {
        type: sourceType,
        name: sourceName,
        url: sourceUrl,
        rule: sourceRule,
      },
      oddsConfig: {
        mode: oddsMode,
        spreadPolicy,
      },
      oddsYes,
      oddsNo,
      oddsChangeReason: oddsChangeReason || undefined,
    };

    try {
      if (isEditing && id) {
        const result = AdminRepository.updateEvent(id, formData, oddsChangeReason);
        if (result) {
          toast.success('Evento atualizado com sucesso');
          navigate(`/admin/events/${id}`);
        }
      } else {
        const result = AdminRepository.createEvent(formData);
        toast.success('Evento criado com sucesso');
        navigate(`/admin/events/${result.id}`);
      }
    } catch (error) {
      toast.error('Erro ao salvar evento');
    } finally {
      setLoading(false);
    }
  };

  const isSourceEditable = !isEditing || event?.status === 'HALTED';
  const isOddsEditable = !isEditing || event?.status === 'OPEN' || event?.status === 'HALTED';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Evento' : 'Criar Novo Evento'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize as informações do evento' : 'Preencha os dados para criar um novo evento'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Block A - Event Data */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Evento</CardTitle>
            <CardDescription>Informações básicas do evento preditivo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Taxa Selic será maior que 12% em Março 2025?"
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição Objetiva *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva claramente o que será avaliado e como..."
                rows={3}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
              </div>

              <div className="space-y-2">
                <Label>Data de Expiração *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !expiryAt && 'text-muted-foreground',
                        errors.expiryAt && 'border-destructive'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiryAt ? format(expiryAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiryAt}
                      onSelect={setExpiryAt}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {errors.expiryAt && <p className="text-xs text-destructive">{errors.expiryAt}</p>}
              </div>
            </div>

            {!isEditing && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  O evento será criado como <strong>Rascunho</strong>. Você poderá abri-lo para apostas depois.
                </AlertDescription>
              </Alert>
            )}

            {/* Image Editor */}
            <ImageEditor
              value={imageData.url}
              onChange={setImageData}
              error={errors.image}
            />
          </CardContent>
        </Card>

        {/* Block B - Resolution Source */}
        <Card>
          <CardHeader>
            <CardTitle>Fonte Oficial de Resolução *</CardTitle>
            <CardDescription>
              Toda liquidação precisa apontar para uma fonte pública verificável
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSourceEditable && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A fonte oficial não pode ser alterada após o evento ser aberto.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Tipo da Fonte *</Label>
              <Select 
                value={sourceType} 
                onValueChange={(v) => setSourceType(v as ResolutionSourceType)}
                disabled={!isSourceEditable}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="API">API - Dados automáticos</SelectItem>
                  <SelectItem value="DATASET">Dataset - Dados públicos</SelectItem>
                  <SelectItem value="MANUAL">Manual - Verificação humana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceName">Nome da Fonte *</Label>
              <Input
                id="sourceName"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Ex: BCB - Taxa Selic, IBGE - IPCA"
                disabled={!isSourceEditable}
                className={errors.sourceName ? 'border-destructive' : ''}
              />
              {errors.sourceName && <p className="text-xs text-destructive">{errors.sourceName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceUrl">URL Pública *</Label>
              <Input
                id="sourceUrl"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                disabled={!isSourceEditable}
                className={errors.sourceUrl ? 'border-destructive' : ''}
              />
              {errors.sourceUrl && <p className="text-xs text-destructive">{errors.sourceUrl}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceRule">Regra Objetiva de Resolução *</Label>
              <Textarea
                id="sourceRule"
                value={sourceRule}
                onChange={(e) => setSourceRule(e.target.value)}
                placeholder="Ex: PTAX < 4.80 no dia 31/12"
                rows={2}
                disabled={!isSourceEditable}
                className={errors.sourceRule ? 'border-destructive' : ''}
              />
              {errors.sourceRule && <p className="text-xs text-destructive">{errors.sourceRule}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Block C - Odds Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração de Odds</CardTitle>
            <CardDescription>
              Defina as probabilidades iniciais do evento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isOddsEditable && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  As odds só podem ser alteradas enquanto o evento está aberto.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modo de Odds</Label>
                <Select 
                  value={oddsMode} 
                  onValueChange={(v) => setOddsMode(v as OddsMode)}
                  disabled={!isOddsEditable}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL_PROBABILITY">Probabilidade Manual</SelectItem>
                    <SelectItem value="MANUAL_PRICE">Preço Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Política de Spread</Label>
                <Select 
                  value={spreadPolicy} 
                  onValueChange={(v) => setSpreadPolicy(v as SpreadPolicy)}
                  disabled={!isOddsEditable}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO_COMPLEMENT">Complemento Automático</SelectItem>
                    <SelectItem value="MANUAL_BOTH">Manual Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Odds Slider */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Preço SIM: {oddsYes}%</Label>
                <Label>Preço NÃO: {oddsNo}%</Label>
              </div>
              <Slider
                value={[oddsYes]}
                onValueChange={([value]) => setOddsYes(value)}
                min={1}
                max={99}
                step={1}
                disabled={!isOddsEditable}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1%</span>
                <span>50%</span>
                <span>99%</span>
              </div>
            </div>

            {spreadPolicy === 'MANUAL_BOTH' && (
              <div className="space-y-2">
                <Label>Preço NÃO (Manual)</Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={oddsNo}
                  onChange={(e) => setOddsNo(Number(e.target.value))}
                  disabled={!isOddsEditable}
                />
              </div>
            )}

            {errors.oddsYes && <p className="text-xs text-destructive">{errors.oddsYes}</p>}
            {errors.oddsNo && <p className="text-xs text-destructive">{errors.oddsNo}</p>}
            {errors.oddsTotal && <p className="text-xs text-destructive">{errors.oddsTotal}</p>}

            {/* Odds Change Reason (only when editing) */}
            {isEditing && event && (oddsYes !== event.odds.yes || oddsNo !== event.odds.no) && (
              <div className="space-y-2">
                <Label htmlFor="oddsChangeReason">Motivo da Alteração *</Label>
                <Textarea
                  id="oddsChangeReason"
                  value={oddsChangeReason}
                  onChange={(e) => setOddsChangeReason(e.target.value)}
                  placeholder="Explique o motivo da alteração das odds..."
                  rows={2}
                  className={errors.oddsChangeReason ? 'border-destructive' : ''}
                />
                {errors.oddsChangeReason && <p className="text-xs text-destructive">{errors.oddsChangeReason}</p>}
              </div>
            )}

            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className={`p-3 rounded-lg ${oddsYes >= 50 ? 'bg-success/20' : 'bg-muted'}`}>
                  <p className="text-2xl font-bold">{oddsYes}%</p>
                  <p className="text-sm text-muted-foreground">SIM</p>
                </div>
                <div className={`p-3 rounded-lg ${oddsNo >= 50 ? 'bg-destructive/20' : 'bg-muted'}`}>
                  <p className="text-2xl font-bold">{oddsNo}%</p>
                  <p className="text-sm text-muted-foreground">NÃO</p>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Total: {oddsYes + oddsNo}%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Evento'}
          </Button>
        </div>
      </form>
    </div>
  );
}
