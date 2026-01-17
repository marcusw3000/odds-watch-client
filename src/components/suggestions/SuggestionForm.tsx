import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Lightbulb } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SuggestionService } from '@/services/SuggestionService';
import { useToast } from '@/hooks/use-toast';
import type { CreateSuggestionData, Suggestion } from '@/types/suggestion';

const formSchema = z.object({
  title: z
    .string()
    .min(10, 'Título deve ter pelo menos 10 caracteres')
    .max(200, 'Título deve ter no máximo 200 caracteres'),
  description: z
    .string()
    .min(30, 'Descrição deve ter pelo menos 30 caracteres')
    .max(2000, 'Descrição deve ter no máximo 2000 caracteres'),
  category: z.string().min(1, 'Selecione uma categoria'),
});

type FormData = z.infer<typeof formSchema>;

interface SuggestionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (suggestion: Suggestion) => void;
  editSuggestion?: Suggestion;
}

export function SuggestionForm({ 
  open, 
  onOpenChange, 
  onSuccess,
  editSuggestion 
}: SuggestionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const categories = SuggestionService.getCategories();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: editSuggestion?.title || '',
      description: editSuggestion?.description || '',
      category: editSuggestion?.category || 'geral',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const suggestionData: CreateSuggestionData = {
        title: data.title,
        description: data.description,
        category: data.category,
      };

      let suggestion: Suggestion;
      if (editSuggestion) {
        suggestion = await SuggestionService.updateSuggestion(
          editSuggestion.id, 
          suggestionData
        );
        toast({
          title: 'Sugestão atualizada!',
          description: 'Sua sugestão foi atualizada com sucesso.',
        });
      } else {
        suggestion = await SuggestionService.createSuggestion(suggestionData);
        toast({
          title: 'Sugestão enviada!',
          description: 'Sua sugestão foi enviada e está aguardando votação.',
        });
      }

      form.reset();
      onOpenChange(false);
      onSuccess?.(suggestion);
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar sua sugestão. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            {editSuggestion ? 'Editar Sugestão' : 'Nova Sugestão de Mercado'}
          </DialogTitle>
          <DialogDescription>
            Sugira um novo mercado para ser criado. A comunidade irá votar e os 
            mais populares serão analisados pela equipe.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do Mercado</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: O Brasil vai ganhar a Copa do Mundo 2026?"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Formule como uma pergunta clara de sim/não.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o contexto, as regras de resolução, e por que este mercado seria interessante..."
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Inclua detalhes sobre como o mercado seria resolvido e a data limite.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editSuggestion ? 'Salvar Alterações' : 'Enviar Sugestão'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
