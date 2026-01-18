import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Send, Loader2, User, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getTicketMessages, sendMessage } from '@/services/SupportService';
import { STATUS_LABELS, CATEGORY_LABELS, type SupportTicket, type SupportStatus } from '@/types/support';
import { cn } from '@/lib/utils';

interface TicketChatProps {
  ticket: SupportTicket;
  onBack: () => void;
}

const STATUS_VARIANTS: Record<SupportStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'default',
  in_progress: 'secondary',
  waiting_customer: 'outline',
  resolved: 'secondary',
  closed: 'outline',
};

export function TicketChat({ ticket, onBack }: TicketChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['ticket-messages', ticket.id],
    queryFn: () => getTicketMessages(ticket.id),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => sendMessage(ticket.id, message),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticket.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao enviar mensagem');
    },
  });

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTicketClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="border-b shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{ticket.subject}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={STATUS_VARIANTS[ticket.status]}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {CATEGORY_LABELS[ticket.category]}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.is_staff ? 'flex-row' : 'flex-row-reverse'
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {message.is_staff ? (
                      <>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Headphones className="h-4 w-4" />
                        </AvatarFallback>
                      </>
                    ) : (
                      <>
                        <AvatarImage src={message.sender_avatar} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div
                    className={cn(
                      'flex flex-col max-w-[75%]',
                      message.is_staff ? 'items-start' : 'items-end'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {message.is_staff ? 'Suporte' : message.sender_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'rounded-lg px-4 py-2',
                        message.is_staff
                          ? 'bg-muted text-foreground'
                          : 'bg-primary text-primary-foreground'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {!isTicketClosed ? (
          <div className="border-t p-4 shrink-0">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="min-h-[80px] resize-none"
                maxLength={2000}
              />
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || sendMutation.isPending}
                className="shrink-0"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t p-4 shrink-0 bg-muted/50">
            <p className="text-center text-sm text-muted-foreground">
              Este ticket está {ticket.status === 'closed' ? 'fechado' : 'resolvido'}.
              {' '}Abra um novo ticket se precisar de mais ajuda.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
