import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const MAX_LENGTH = 300;

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = value.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const isNearLimit = charCount >= MAX_LENGTH * 0.8;

  return (
    <div className="border-t border-border p-3 bg-background">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Faça login para participar' : 'Digite uma mensagem...'}
          disabled={disabled}
          className="min-h-[40px] max-h-[100px] resize-none text-sm"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || !value.trim() || isOverLimit}
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex justify-end mt-1">
        <span
          className={cn(
            'text-[10px] transition-colors',
            isOverLimit
              ? 'text-destructive'
              : isNearLimit
                ? 'text-warning'
                : 'text-muted-foreground'
          )}
        >
          {charCount}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
