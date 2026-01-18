import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Plus, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getMyTickets } from '@/services/SupportService';
import { CATEGORY_LABELS, STATUS_LABELS, type SupportTicket, type SupportStatus } from '@/types/support';
import { CreateTicketDialog } from './CreateTicketDialog';
import { TicketChat } from './TicketChat';

const STATUS_VARIANTS: Record<SupportStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'default',
  in_progress: 'secondary',
  waiting_customer: 'outline',
  resolved: 'secondary',
  closed: 'outline',
};

export function SupportTicketsList() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['my-support-tickets'],
    queryFn: getMyTickets,
  });

  if (selectedTicket) {
    return (
      <TicketChat
        ticket={selectedTicket}
        onBack={() => {
          setSelectedTicket(null);
          refetch();
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Meus Tickets
            </CardTitle>
            <CardDescription>
              Gerencie seus tickets de suporte e acompanhe o status.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Ticket
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Você ainda não tem tickets de suporte.</p>
            <p className="text-sm">Clique em "Novo Ticket" para abrir um chamado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{ticket.subject}</span>
                    <Badge variant={STATUS_VARIANTS[ticket.status]}>
                      {STATUS_LABELS[ticket.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{CATEGORY_LABELS[ticket.category]}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(ticket.created_at), "dd 'de' MMM", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          refetch();
          setCreateOpen(false);
        }}
      />
    </Card>
  );
}
