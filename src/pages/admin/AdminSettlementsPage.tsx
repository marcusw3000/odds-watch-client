import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Scale, 
  AlertTriangle, 
  ExternalLink, 
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Trophy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePendingSettlements, useSettleEvent, AdminEvent } from '@/hooks/useAdminEvents';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface MarketOption {
  id: string;
  label: string;
  current_price: number;
}

export function AdminSettlementsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventId = searchParams.get('event');

  const { data: closedEvents = [], isLoading } = usePendingSettlements();
  const settleEventMutation = useSettleEvent();

  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [evidence, setEvidence] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [marketOptions, setMarketOptions] = useState<MarketOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Load market options when selecting a MULTIPLE market
  useEffect(() => {
    if (selectedEvent?.market_type === 'MULTIPLE') {
      setLoadingOptions(true);
      supabase
        .from('market_options')
        .select('id, label, current_price')
        .eq('market_id', selectedEvent.id)
        .order('display_order')
        .then(({ data, error }) => {
          if (!error && data) {
            setMarketOptions(data);
          }
          setLoadingOptions(false);
        });
    } else {
      setMarketOptions([]);
    }
    // Reset result when changing event
    setResult(null);
  }, [selectedEvent]);

  // Select event from URL param
  useEffect(() => {
    if (eventId && closedEvents.length > 0) {
      const event = closedEvents.find(e => e.id === eventId);
      if (event) {
        setSelectedEvent(event);
      }
    }
  }, [eventId, closedEvents]);

  const handleSettle = () => {
    if (!selectedEvent || !result || !evidence.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setConfirmDialog(true);
  };

  const confirmSettlement = async () => {
    if (!selectedEvent || !result || !evidence.trim()) return;

    try {
      await settleEventMutation.mutateAsync({
        eventId: selectedEvent.id,
        result,
        evidence,
      });

      toast.success('Evento liquidado com sucesso! Pagamentos e comissões processados.');
      // Redirecionar para a página de detalhes do evento liquidado
      navigate(`/admin/events/${selectedEvent.id}`);
    } catch (error) {
      toast.error('Erro ao liquidar evento');
    }

    setConfirmDialog(false);
  };

  // Parse resolution from event
  const getResolutionSource = (event: AdminEvent) => {
    if (event.resolution && typeof event.resolution === 'object') {
      return event.resolution as { 
        type?: string; 
        name?: string; 
        url?: string; 
        rule?: string; 
      };
    }
    return { type: 'MANUAL', name: '', url: '', rule: '' };
  };

  if (selectedEvent) {
    const resolutionSource = getResolutionSource(selectedEvent);

    return (
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedEvent(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Liquidar Evento</h1>
            <p className="text-muted-foreground">Defina o resultado oficial do evento</p>
          </div>
        </div>

        {/* Event Info */}
        <Card>
          <CardHeader>
            <CardTitle>{selectedEvent.title}</CardTitle>
            <CardDescription>{selectedEvent.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Categoria</p>
                <p className="font-medium">{selectedEvent.category}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expirou em</p>
                <p className="font-medium">
                  {selectedEvent.close_date && format(new Date(selectedEvent.close_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resolution Source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Fonte Oficial
              <Badge variant="outline">{resolutionSource.type || selectedEvent.settlement_type}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium">{resolutionSource.name || '-'}</p>
            </div>
            {resolutionSource.url && (
              <div>
                <p className="text-sm text-muted-foreground">URL</p>
                <a
                  href={resolutionSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {resolutionSource.url}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {resolutionSource.rule && (
              <div>
                <p className="text-sm text-muted-foreground">Regra de Resolução</p>
                <p className="font-medium bg-muted/50 p-3 rounded-lg border">
                  {resolutionSource.rule}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settlement Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Definir Resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Result Selection */}
            <div className="space-y-3">
              <Label>Qual foi o resultado? *</Label>
              
              {selectedEvent.market_type === 'MULTIPLE' ? (
                // Multi-option market: show dropdown with options
                loadingOptions ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando opções...
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select value={result || ''} onValueChange={setResult}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a opção vencedora" />
                      </SelectTrigger>
                      <SelectContent>
                        {marketOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-warning" />
                              <span>{option.label}</span>
                              <span className="text-muted-foreground">
                                ({Math.round(option.current_price * 100)}%)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Selecione qual opção venceu o mercado
                    </p>
                  </div>
                )
              ) : (
                // Binary market: show YES/NO buttons
                <RadioGroup 
                  value={result || ''} 
                  onValueChange={setResult}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem value="YES" id="yes" className="peer sr-only" />
                    <Label
                      htmlFor="yes"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-success peer-data-[state=checked]:bg-success/10 cursor-pointer"
                    >
                      <CheckCircle2 className="h-8 w-8 mb-2 text-success" />
                      <span className="text-lg font-bold">SIM</span>
                      <span className="text-sm text-muted-foreground">O evento ocorreu</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="NO" id="no" className="peer sr-only" />
                    <Label
                      htmlFor="no"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-destructive peer-data-[state=checked]:bg-destructive/10 cursor-pointer"
                    >
                      <AlertTriangle className="h-8 w-8 mb-2 text-destructive" />
                      <span className="text-lg font-bold">NÃO</span>
                      <span className="text-sm text-muted-foreground">O evento não ocorreu</span>
                    </Label>
                  </div>
                </RadioGroup>
              )}
            </div>

            {/* Evidence URL */}
            <div className="space-y-2">
              <Label htmlFor="evidence">Link de Evidência *</Label>
              <Input
                id="evidence"
                type="url"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="https://... (link para fonte oficial confirmando o resultado)"
              />
              <p className="text-xs text-muted-foreground">
                Cole o link da fonte oficial que comprova o resultado
              </p>
            </div>

            {/* Warning */}
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Ação Irreversível</AlertTitle>
              <AlertDescription>
                A liquidação é <strong>final e irreversível</strong>. Uma vez confirmada, 
                os pagamentos serão processados e o evento não poderá ser alterado.
              </AlertDescription>
            </Alert>

            {/* Submit */}
            <Button 
              onClick={handleSettle} 
              className="w-full" 
              size="lg"
              disabled={!result || !evidence.trim() || settleEventMutation.isPending}
            >
              {settleEventMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Scale className="h-4 w-4 mr-2" />
              )}
              Liquidar Evento
            </Button>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialog} onOpenChange={setConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirmar Liquidação
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>Você está prestes a liquidar o evento:</p>
                <p className="font-medium">{selectedEvent.title}</p>
                <p>
                  Resultado:{' '}
                  {selectedEvent.market_type === 'MULTIPLE' ? (
                    <strong className="text-warning">
                      {marketOptions.find(o => o.id === result)?.label || result}
                    </strong>
                  ) : (
                    <strong className={result === 'YES' ? 'text-success' : 'text-destructive'}>
                      {result === 'YES' ? 'SIM' : 'NÃO'}
                    </strong>
                  )}
                </p>
                <p className="text-destructive font-medium">
                  Esta ação é IRREVERSÍVEL. Tem certeza?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmSettlement}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmar Liquidação
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Liquidações</h1>
        <p className="text-muted-foreground mt-1">
          Eventos aguardando definição de resultado
        </p>
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : closedEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum evento aguardando liquidação</p>
            <p className="text-sm text-muted-foreground mt-1">
              Eventos fechados aparecerão aqui para serem liquidados
            </p>
            <Link to="/admin/events" className="mt-4 inline-block">
              <Button variant="outline">Ver Todos os Eventos</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {closedEvents.map((event) => (
            <Card key={event.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium">{event.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{event.category}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="text-muted-foreground">
                        Expirou em {event.close_date && format(new Date(event.close_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-muted-foreground">
                        SIM: {Math.round(event.current_yes_price * 100)}% / NÃO: {Math.round(event.current_no_price * 100)}%
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => setSelectedEvent(event)}>
                    <Scale className="h-4 w-4 mr-2" />
                    Liquidar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}