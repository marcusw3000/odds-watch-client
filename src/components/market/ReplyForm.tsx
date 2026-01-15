import { useState } from 'react';
import { Reply, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MentionInput } from './MentionInput';

interface ReplyFormProps {
  replyingTo: string;
  onSubmit: (content: string, mentions: string[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ReplyForm({
  replyingTo,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ReplyFormProps) {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;
    await onSubmit(content.trim(), mentions);
    setContent('');
    setMentions([]);
  };

  return (
    <div className="mt-2 ml-8 p-3 bg-muted/50 rounded-lg border border-border/50">
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
        <Reply className="h-4 w-4" />
        Respondendo a <span className="font-medium text-primary">@{replyingTo}</span>
      </div>

      <MentionInput
        value={content}
        onChange={setContent}
        onMentionsChange={setMentions}
        placeholder="Escreva sua resposta..."
        autoFocus
        minHeight="60px"
      />

      <div className="flex justify-end gap-2 mt-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Enviando...
            </>
          ) : (
            'Responder'
          )}
        </Button>
      </div>
    </div>
  );
}
