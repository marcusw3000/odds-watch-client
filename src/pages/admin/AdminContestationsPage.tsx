import { useEffect, useState } from 'react';
import { AdminDataProvider } from '@/services/AdminDataProvider';
import { ContestationWithEvent } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export function AdminContestationsPage() {
  const [contestations, setContestations] = useState<ContestationWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const data = await AdminDataProvider.getPendingContestations();
    setContestations(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReview = async (c: ContestationWithEvent, status: 'ACCEPTED' | 'REJECTED') => {
    await AdminDataProvider.reviewContestation({
      contestationId: c.id, eventId: c.event.id, status, reviewNotes: reviewNotes[c.id] || '',
    });
    toast.success(status === 'ACCEPTED' ? 'Contestação aceita - resultado revertido' : 'Contestação rejeitada');
    load();
  };

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contestações</h1>
      
      {contestations.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle className="mb-4 h-12 w-12 text-success" />
          <p className="text-lg font-medium">Nenhuma contestação pendente</p>
          <p className="text-muted-foreground">Todas as contestações foram revisadas</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {contestations.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{c.event.title}</CardTitle>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">Resultado: {c.event.result}</Badge>
                      <span>•</span>
                      <span>Fonte: {c.event.resultSource}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/markets/${c.event.id}`}><ExternalLink className="mr-2 h-3 w-3" />Ver Mercado</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-warning/5 border border-warning/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
                    <div>
                      <p className="font-medium text-warning">Contestação de {c.userId}</p>
                      <p className="mt-1 text-sm">{c.reason}</p>
                      {c.evidence && <a href={c.evidence} target="_blank" className="mt-2 inline-flex items-center text-sm text-primary hover:underline">Ver evidência <ExternalLink className="ml-1 h-3 w-3" /></a>}
                      <p className="mt-2 text-xs text-muted-foreground">Submetida em {format(c.submittedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Textarea placeholder="Notas da revisão..." value={reviewNotes[c.id] || ''} onChange={(e) => setReviewNotes({ ...reviewNotes, [c.id]: e.target.value })} />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => handleReview(c, 'REJECTED')}>
                    <XCircle className="mr-2 h-4 w-4" />Rejeitar
                  </Button>
                  <Button className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => handleReview(c, 'ACCEPTED')}>
                    <CheckCircle className="mr-2 h-4 w-4" />Aceitar e Reverter
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
