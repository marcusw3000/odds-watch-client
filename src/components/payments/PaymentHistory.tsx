import { ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePayments, usePendingPayments } from '@/hooks/usePayments';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PaymentStatus, PaymentType } from '@/types/payment';

const statusConfig: Record<PaymentStatus, { icon: React.ElementType; label: string; color: string }> = {
  PENDING: { icon: Clock, label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-500' },
  PROCESSING: { icon: Loader2, label: 'Processando', color: 'bg-blue-500/10 text-blue-500' },
  COMPLETED: { icon: CheckCircle, label: 'Concluído', color: 'bg-green-500/10 text-green-500' },
  FAILED: { icon: XCircle, label: 'Falhou', color: 'bg-red-500/10 text-red-500' },
  CANCELLED: { icon: XCircle, label: 'Cancelado', color: 'bg-gray-500/10 text-gray-500' },
  REFUNDED: { icon: AlertCircle, label: 'Reembolsado', color: 'bg-purple-500/10 text-purple-500' },
};

const typeConfig: Record<PaymentType, { icon: React.ElementType; label: string; color: string }> = {
  DEPOSIT: { icon: ArrowDownToLine, label: 'Depósito', color: 'text-green-500' },
  WITHDRAWAL: { icon: ArrowUpFromLine, label: 'Saque', color: 'text-orange-500' },
};

export function PaymentHistory() {
  const { data: payments, isLoading } = usePayments();
  const { data: pendingPayments } = usePendingPayments();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasPending = pendingPayments && pendingPayments.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Histórico de Transações
          {hasPending && (
            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">
              {pendingPayments.length} pendente{pendingPayments.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Seus depósitos e saques recentes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!payments || payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma transação ainda</p>
            <p className="text-sm">Faça seu primeiro depósito para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => {
              const status = statusConfig[payment.status];
              const type = typeConfig[payment.type];
              const StatusIcon = status.icon;
              const TypeIcon = type.icon;

              return (
                <div 
                  key={payment.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${type.color} bg-current/10`}>
                    <TypeIcon className={`h-5 w-5 ${type.color}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{type.label}</span>
                      <Badge variant="outline" className={`${status.color} text-xs`}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${payment.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{payment.method}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(payment.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`font-bold font-mono ${payment.type === 'DEPOSIT' ? 'text-green-500' : 'text-orange-500'}`}>
                      {payment.type === 'DEPOSIT' ? '+' : '-'}R${payment.amount.toFixed(2)}
                    </p>
                    {payment.fee > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Taxa: R${payment.fee.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
