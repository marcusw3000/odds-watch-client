import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Info, CalendarIcon, Loader2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminEvent, useCreateEvent, useUpdateEvent, AdminEvent } from '@/hooks/useAdminEvents';
import { 
  EVENT_CATEGORIES, 
  ResolutionSourceType 
} from '@/types/admin';
import { ImageEditor } from '@/components/admin/ImageEditor';
import { TagsInput } from '@/components/admin/TagsInput';
import { CardStyleSelector } from '@/components/admin/CardStyleSelector';
import { MultiOptionEditor, MarketOption } from '@/components/admin/MultiOptionEditor';
import { CardStyleType } from '@/types/cardStyles';
import { MarketType } from '@/types/marketOption';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AdminEventFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  // Fetch event data from Supabase when editing
  const { data: eventData, isLoading: loadingEvent, error: eventError } = useAdminEvent(id);
  const event = eventData?.event;

  // Mutations
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();

  const loading = createEventMutation.isPending || updateEventMutation.isPending;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [expiryAt, setExpiryAt] = useState<Date | undefined>();
  
  // Market type (Binary vs Multiple)
  const [marketType, setMarketType] = useState<MarketType>('BINARY');
  
  // Multiple options (for MULTIPLE type)
  const [options, setOptions] = useState<MarketOption[]>([
    { label: '', probability: 50, displayOrder: 0 },
    { label: '', probability: 50, displayOrder: 1 },
  ]);
  
  // Resolution Source
  const [sourceType, setSourceType] = useState<ResolutionSourceType>('MANUAL');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceRule, setSourceRule] = useState('');
  
  // Odds (for Binary type)
  const [oddsYes, setOddsYes] = useState(50);
  const [initialOddsYes, setInitialOddsYes] = useState(50);
  const [oddsChangeReason, setOddsChangeReason] = useState('');

  // Card style
  const [cardStyle, setCardStyle] = useState<CardStyleType>('default');

  // Tags state
  const [tags, setTags] = useState<string[]>([]);

  // Image state
  const [imageData, setImageData] = useState<{ url: string; zoom: number; position: { x: number; y: number } }>({
    url: '',
    zoom: 1,
    position: { x: 50, y: 50 },
  });

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form when event data loads
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setCategory(event.category);
      setExpiryAt(event.close_date ? parseISO(event.close_date) : undefined);
      
      // Set market type
      setMarketType((event.market_type as MarketType) || 'BINARY');
      
      // Map resolution from Supabase
      const resolution = event.resolution as { type?: string; name?: string; url?: string; rule?: string } | null;
      if (resolution) {
        setSourceType((resolution.type as ResolutionSourceType) || 'MANUAL');
        setSourceName(resolution.name || '');
        setSourceUrl(resolution.url || '');
        setSourceRule(resolution.rule || '');
      }
      
      // Convert price (0-1) to percentage (0-100)
      const yesPercentage = Math.round(event.current_yes_price * 100);
      setOddsYes(yesPercentage);
      setInitialOddsYes(yesPercentage);
      
      setCardStyle((event.card_style as CardStyleType) || 'default');
      setTags(event.tags || []);
      setImageData({
        url: event.image_url || '',
        zoom: 1,
        position: { x: 50, y: 50 },
      });
      
      // Load options if MULTIPLE type
      // Note: options would be loaded separately via a different query if needed
    }
  }, [event]);

  // Redirect if event not found after loading
  useEffect(() => {
    if (isEditing && !loadingEvent && eventError) {
      toast.error('Evento não encontrado');
      navigate('/admin/events');
    }
  }, [isEditing, loadingEvent, eventError, navigate]);

  // Calculate complement automatically
  const oddsNo = 100 - oddsYes;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Título é obrigatório';
    if (!description.trim()) newErrors.description = 'Descrição é obrigatória';
    if (!category) newErrors.category = 'Categoria é obrigatória';
    if (!expiryAt) newErrors.expiryAt = 'Data de expiração é obrigatória';
    if (!sourceName.trim()) newErrors.sourceName = 'Nome da fonte é obrigatório';
    if (!sourceUrl.trim()) newErrors.sourceUrl = 'URL da fonte é obrigatória';
    if (!sourceRule.trim()) newErrors.sourceRule = 'Regra de resolução é obrigatória';
    
    if (marketType === 'BINARY') {
      if (oddsYes < 1 || oddsYes > 99) newErrors.oddsYes = 'Probabilidade SIM deve estar entre 1% e 99%';
      
      // If editing and odds changed, require reason
      if (isEditing && oddsYes !== initialOddsYes) {
        if (!oddsChangeReason.trim()) {
          newErrors.oddsChangeReason = 'Motivo da alteração é obrigatório';
        }
      }
    } else {
      // Validate multiple options
      if (options.length < 2) {
        newErrors.options = 'Mínimo de 2 opções é obrigatório';
      }
      
      const emptyLabels = options.filter(o => !o.label.trim());
      if (emptyLabels.length > 0) {
        newErrors.options = 'Todas as opções devem ter um nome';
      }
      
      const probSum = options.reduce((sum, o) => sum + o.probability, 0);
      if (probSum < 99 || probSum > 101) {
        newErrors.options = 'A soma das probabilidades deve ser 100%';
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

    const resolution = {
      type: sourceType,
      name: sourceName,
      url: sourceUrl,
      rule: sourceRule,
    };

    try {
      if (isEditing && id) {
        await updateEventMutation.mutateAsync({
          eventId: id,
          title,
          description,
          category,
          closeDate: expiryAt!.toISOString(),
          imageUrl: imageData.url || undefined,
          tags,
          yesPrice: marketType === 'BINARY' ? oddsYes / 100 : undefined,
          settlementType: sourceType,
          resolution,
          cardStyle,
          reason: oddsChangeReason || undefined,
        });
        toast.success('Evento atualizado com sucesso');
        navigate(`/admin/events/${id}`);
      } else {
        const result = await createEventMutation.mutateAsync({
          title,
          description,
          category,
          closeDate: expiryAt!.toISOString(),
          imageUrl: imageData.url || undefined,
          tags,
          yesPrice: marketType === 'BINARY' ? oddsYes / 100 : undefined,
          settlementType: sourceType,
          resolution,
          cardStyle,
          marketType,
          options: marketType === 'MULTIPLE' ? options.map(o => ({
            label: o.label,
            description: o.description,
            imageUrl: o.imageUrl,
            probability: o.probability,
            displayOrder: o.displayOrder,
          })) : undefined,
        });
        toast.success('Evento criado com sucesso');
        navigate(`/admin/events/${result.event.id}`);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(`Erro ao salvar evento: ${err?.message || 'Erro desconhecido'}`);
    }
  };

  const isSourceEditable = true;
  const isOddsEditable = !isEditing || event?.status === 'OPEN' || event?.status === 'HALTED';

  // Loading state for edit mode
  if (isEditing && loadingEvent) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
                  O evento será criado com status <strong>OPEN</strong> e estará disponível para negociações.
                </AlertDescription>
              </Alert>
            )}

            {/* Image Editor */}
            <ImageEditor
              value={imageData.url}
              onChange={setImageData}
              error={errors.image}
            />

            {/* Tags */}
            <TagsInput
              value={tags}
              onChange={setTags}
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

        {/* Block C - Market Type & Probability */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Mercado e Probabilidades</CardTitle>
            <CardDescription>
              Escolha entre mercado binário (SIM/NÃO) ou múltiplas opções (estilo Kalshi)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Market Type Toggle - only for new events */}
            {!isEditing && (
              <Tabs value={marketType} onValueChange={(v) => setMarketType(v as MarketType)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="BINARY">Binário (SIM/NÃO)</TabsTrigger>
                  <TabsTrigger value="MULTIPLE">Múltiplas Opções</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {isEditing && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Tipo de mercado: <strong>{marketType === 'BINARY' ? 'Binário' : 'Múltiplas Opções'}</strong>
                  {' '}(não pode ser alterado após criação)
                </AlertDescription>
              </Alert>
            )}

            {!isOddsEditable && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  As probabilidades só podem ser alteradas enquanto o evento está aberto ou pausado.
                </AlertDescription>
              </Alert>
            )}

            {/* Binary Market Options */}
            {marketType === 'BINARY' && (
              <>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>SIM: {oddsYes}%</Label>
                    <Label>NÃO: {oddsNo}%</Label>
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

                {errors.oddsYes && <p className="text-xs text-destructive">{errors.oddsYes}</p>}

                {isEditing && oddsYes !== initialOddsYes && (
                  <div className="space-y-2">
                    <Label htmlFor="oddsChangeReason">Motivo da Alteração *</Label>
                    <Textarea
                      id="oddsChangeReason"
                      value={oddsChangeReason}
                      onChange={(e) => setOddsChangeReason(e.target.value)}
                      placeholder="Explique o motivo da alteração da probabilidade..."
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
              </>
            )}

            {/* Multiple Options Editor */}
            {marketType === 'MULTIPLE' && (
              <>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Mercados com múltiplas opções funcionam como a Kalshi: cada opção é um contrato independente 
                    e a soma de todas as probabilidades sempre será 100%.
                  </AlertDescription>
                </Alert>
                <MultiOptionEditor
                  options={options}
                  onChange={setOptions}
                  disabled={!isOddsEditable}
                />
                {errors.options && <p className="text-xs text-destructive">{errors.options}</p>}
              </>
            )}
          </CardContent>
        </Card>

        {/* Block D - Card Appearance */}
        <CardStyleSelector
          value={cardStyle}
          onChange={setCardStyle}
          previewEvent={{
            title: title || 'Título do evento',
            category: category || 'Economia',
            outcomes: {
              YES: { price: oddsYes, probability: oddsYes },
              NO: { price: oddsNo, probability: oddsNo },
            },
          }}
        />

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
