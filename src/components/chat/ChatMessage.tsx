import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessage as ChatMessageType } from '@/hooks/useGlobalChat';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwn: boolean;
  onReport: (id: string) => void;
}

export function ChatMessageItem({ message, isOwn, onReport }: ChatMessageProps) {
  const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={cn('flex flex-col gap-0.5 max-w-[85%] group', isOwn ? 'self-end items-end' : 'self-start items-start')}>
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[120px]">
          {isOwn ? 'Você' : message.display_name}
        </span>
        <span className="text-[10px] text-muted-foreground/60">{time}</span>
      </div>

      <div className="flex items-end gap-1">
        {isOwn && !isOwn && null}
        <div
          className={cn(
            'rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          )}
        >
          {message.content}
        </div>

        {!isOwn && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Flag className="h-3 w-3 text-muted-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reportar mensagem</AlertDialogTitle>
                <AlertDialogDescription>
                  Deseja reportar esta mensagem como inadequada?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onReport(message.id)}>
                  Reportar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
