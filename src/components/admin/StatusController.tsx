import { useState } from 'react';
import { MarketEvent, MarketStatus } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Play, Pause, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StatusControllerProps {
  market: MarketEvent;
  onForceHalt: (reason: string) => Promise<void>;
  onResumeTrading: () => Promise<void>;
  onSubmitResult: (result: 'YES' | 'NO', source: string) => Promise<void>;
  onExecuteSettlement: () => Promise<void>;
  onRevertResult: () => Promise<void>;
  isLoading?: boolean;
}

const statusConfig: Record<MarketStatus, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: 'Aberto', color: 'bg-success/10 text-success border-success/20', icon: Play },
  HALTED: { label: 'Pausado', color: 'bg-warning/10 text-warning border-warning/20', icon: Pause },
  PENDING: { label: 'Aguardando', color: 'bg-primary/10 text-primary border-primary/20', icon: Clock },
  CONTESTED: { label: 'Contestado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
  SETTLED: { label: 'Liquidado', color: 'bg-muted text-muted-foreground border-border', icon: CheckCircle },
};

export function StatusController({
  market,
  onForceHalt,
  onResumeTrading,
  onSubmitResult,
  onExecuteSettlement,
  onRevertResult,
  isLoading = false,
}: StatusControllerProps) {
  const [haltReason, setHaltReason] = useState('');
  const [result, setResult] = useState<'YES' | 'NO'>('YES');
  const [resultSource, setResultSource] = useState('');
  const [showHaltForm, setShowHaltForm] = useState(false);
  const [showResultForm, setShowResultForm] = useState(false);

  const config = statusConfig[market.status];
  const StatusIcon = config.icon;

  const handleForceHalt = async () => {
    if (!haltReason.trim()) return;
    await onForceHalt(haltReason);
    setHaltReason('');
    setShowHaltForm(false);
  };

  const handleSubmitResult = async () => {
    if (!resultSource.trim()) return;
    await onSubmitResult(result, resultSource);
    setResultSource('');
    setShowResultForm(false);
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Controle de Status</CardTitle>
            <CardDescription>Gerencie o estado do mercado</CardDescription>
          </div>
          <Badge variant="outline" className={cn('gap-1.5', config.color)}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timeline Info */}
        <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Halt programado:</span>
            <span className="font-medium">
              {format(market.tradingHaltAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Evento:</span>
            <span className="font-medium">
              {format(market.eventAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </div>
          {market.contestEndAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fim contestação:</span>
              <span className="font-medium">
                {format(market.contestEndAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        {/* Actions based on status */}
        {market.status === 'OPEN' && (
          <div className="space-y-3">
            {!showHaltForm ? (
              <Button
                variant="outline"
                className="w-full border-warning/50 text-warning hover:bg-warning/10"
                onClick={() => setShowHaltForm(true)}
                disabled={isLoading}
              >
                <Pause className="mr-2 h-4 w-4" />
                Forçar Halt
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border border-warning/20 bg-warning/5 p-3">
                <Label htmlFor="halt-reason">Motivo do halt</Label>
                <Textarea
                  id="halt-reason"
                  placeholder="Descreva o motivo do halt emergencial..."
                  value={haltReason}
                  onChange={(e) => setHaltReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHaltForm(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-warning text-warning-foreground hover:bg-warning/90"
                    onClick={handleForceHalt}
                    disabled={isLoading || !haltReason.trim()}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Halt
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {market.status === 'HALTED' && (
          <Button
            className="w-full bg-success text-success-foreground hover:bg-success/90"
            onClick={onResumeTrading}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Play className="mr-2 h-4 w-4" />
            Retomar Trading
          </Button>
        )}

        {market.status === 'PENDING' && (
          <div className="space-y-3">
            {!showResultForm ? (
              <Button
                className="w-full"
                onClick={() => setShowResultForm(true)}
                disabled={isLoading}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Submeter Resultado
              </Button>
            ) : (
              <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <RadioGroup
                    value={result}
                    onValueChange={(v) => setResult(v as 'YES' | 'NO')}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="YES" id="yes" />
                      <Label htmlFor="yes" className="text-success font-medium">SIM</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="NO" id="no" />
                      <Label htmlFor="no" className="text-destructive font-medium">NÃO</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">Fonte Oficial</Label>
                  <Input
                    id="source"
                    placeholder="Ex: COPOM API, B3, IBGE..."
                    value={resultSource}
                    onChange={(e) => setResultSource(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResultForm(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitResult}
                    disabled={isLoading || !resultSource.trim()}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submeter e Iniciar Contestação
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {market.status === 'CONTESTED' && (
          <div className="space-y-3">
            {/* Current result info */}
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Resultado atual:</span>
                <Badge variant={market.result === 'YES' ? 'default' : 'destructive'}>
                  {market.result}
                </Badge>
              </div>
              {market.resultSource && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fonte:</span>
                  <span className="text-sm font-medium">{market.resultSource}</span>
                </div>
              )}
              {market.contestations && market.contestations.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-sm text-warning">
                    {market.contestations.filter(c => c.status === 'OPEN').length} contestação(ões) pendente(s)
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={onRevertResult}
                disabled={isLoading}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reverter Resultado
              </Button>
              <Button
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={onExecuteSettlement}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle className="mr-2 h-4 w-4" />
                Executar Payout
              </Button>
            </div>
          </div>
        )}

        {market.status === 'SETTLED' && (
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <CheckCircle className="mx-auto mb-2 h-8 w-8 text-success" />
            <p className="font-medium">Mercado Liquidado</p>
            <p className="text-sm text-muted-foreground">
              Resultado: <span className={market.result === 'YES' ? 'text-success' : 'text-destructive'}>{market.result}</span>
            </p>
            {market.settledAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Em {format(market.settledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
