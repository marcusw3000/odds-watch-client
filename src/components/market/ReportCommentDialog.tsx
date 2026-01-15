import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { REPORT_REASONS } from '@/types/comment';

interface ReportCommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: 'spam' | 'offensive' | 'misinformation' | 'other', description?: string) => Promise<void>;
}

export function ReportCommentDialog({
  open,
  onOpenChange,
  onSubmit,
}: ReportCommentDialogProps) {
  const [reason, setReason] = useState<'spam' | 'offensive' | 'misinformation' | 'other'>('spam');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(reason, description.trim() || undefined);
      onOpenChange(false);
      setReason('spam');
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Denunciar Comentário
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo da denúncia. Denúncias falsas podem resultar em
            penalidades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={reason}
            onValueChange={(value) => setReason(value as typeof reason)}
            className="space-y-3"
          >
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-start space-x-3">
                <RadioGroupItem value={r.value} id={r.value} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={r.value} className="font-medium cursor-pointer">
                    {r.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="description">Detalhes adicionais (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema com mais detalhes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Flag className="h-4 w-4 mr-2" />
                Enviar Denúncia
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
