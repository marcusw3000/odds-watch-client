import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, XCircle, Clock, Send, FileText } from 'lucide-react';
import { MarketEvent, Contestation } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCountdown } from '@/hooks/useMarketStatus';
import { cn } from '@/lib/utils';

interface ContestationPanelProps {
  event: MarketEvent;
  contestTimeRemaining: number | null;
  onSubmitContestation?: (reason: string, evidence?: string) => Promise<void>;
}

export function ContestationPanel({
  event,
  contestTimeRemaining,
  onSubmitContestation,
}: ContestationPanelProps) {
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canContest = event.status === 'CONTESTED' && contestTimeRemaining && contestTimeRemaining > 0;
  const contestations = event.contestations || [];

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Por favor, descreva o motivo da contestação.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmitContestation?.(reason, evidence || undefined);
      setSuccess(true);
      setReason('');
      setEvidence('');
    } catch (e) {
      setError('Erro ao enviar contestação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getContestationIcon = (status: Contestation['status']) => {
    switch (status) {
      case 'OPEN':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'REVIEWED':
        return <FileText className="h-4 w-4 text-primary" />;
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getContestationLabel = (status: Contestation['status']) => {
    switch (status) {
      case 'OPEN': return 'Aberta';
      case 'REVIEWED': return 'Em revisão';
      case 'ACCEPTED': return 'Aceita';
      case 'REJECTED': return 'Rejeitada';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Result */}
      {event.result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Resultado Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {event.result === 'YES' ? 'SIM' : 'NÃO'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Fonte: {event.resultSource || 'Não especificada'}
                </p>
                {event.resultSubmittedAt && (
                  <p className="text-xs text-muted-foreground">
                    Submetido em: {format(event.resultSubmittedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
              {canContest && contestTimeRemaining && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Contestação encerra em</p>
                  <p className="font-mono font-bold text-lg text-warning">
                    {formatCountdown(contestTimeRemaining)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Contestation Form */}
      {canContest && !success && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Contestar Resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Motivo da contestação *
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva por que você acredita que o resultado está incorreto..."
                className="min-h-[100px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Link de evidência (opcional)
              </label>
              <Input
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="https://exemplo.com/fonte-oficial"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !reason.trim()}
              className="w-full"
            >
              {isSubmitting ? (
                <>Enviando...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Contestação
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {success && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
            <div>
              <p className="font-medium text-success">Contestação enviada!</p>
              <p className="text-sm text-muted-foreground">
                Sua contestação será analisada pela equipe.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Contestations */}
      {contestations.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">
            Contestações ({contestations.length})
          </h4>
          {contestations.map((contestation) => (
            <Card key={contestation.id} className="bg-secondary/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getContestationIcon(contestation.status)}
                      <span className={cn(
                        "text-xs font-medium",
                        contestation.status === 'OPEN' && "text-warning",
                        contestation.status === 'ACCEPTED' && "text-success",
                        contestation.status === 'REJECTED' && "text-destructive"
                      )}>
                        {getContestationLabel(contestation.status)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        • {format(contestation.submittedAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm">{contestation.reason}</p>
                    {contestation.evidence && (
                      <a
                        href={contestation.evidence}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 block"
                      >
                        Ver evidência
                      </a>
                    )}
                    {contestation.reviewNotes && (
                      <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                        Nota da revisão: {contestation.reviewNotes}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Contestations */}
      {contestations.length === 0 && event.status !== 'CONTESTED' && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma contestação registrada para este mercado.</p>
        </div>
      )}
    </div>
  );
}