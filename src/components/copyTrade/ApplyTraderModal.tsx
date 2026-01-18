import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserPlus, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useApplyCopyTrader } from "@/hooks/useCopyTrade";

const applyTraderSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(50, "Nome deve ter no máximo 50 caracteres"),
  bio: z
    .string()
    .trim()
    .min(10, "Bio deve ter pelo menos 10 caracteres")
    .max(500, "Bio deve ter no máximo 500 caracteres"),
});

type ApplyTraderFormData = z.infer<typeof applyTraderSchema>;

interface ApplyTraderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApplyTraderModal({ isOpen, onClose }: ApplyTraderModalProps) {
  const applyMutation = useApplyCopyTrader();

  const form = useForm<ApplyTraderFormData>({
    resolver: zodResolver(applyTraderSchema),
    defaultValues: {
      display_name: "",
      bio: "",
    },
  });

  const onSubmit = (data: ApplyTraderFormData) => {
    applyMutation.mutate({
      display_name: data.display_name,
      bio: data.bio,
    }, {
      onSuccess: () => {
        form.reset();
        onClose();
      },
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Tornar-se um Copy Trader
          </DialogTitle>
          <DialogDescription>
            Compartilhe suas estratégias e ganhe comissões quando outros copiarem seus trades.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome de Exibição</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Trader Pro"
                      {...field}
                      disabled={applyMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Nome público que seus seguidores verão.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sobre Você</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva sua estratégia de trading, experiência e estilo de operação..."
                      className="min-h-[120px] resize-none"
                      {...field}
                      disabled={applyMutation.isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Conte sobre sua experiência e estratégias ({field.value.length}/500 caracteres).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert variant="default" className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Sua candidatura será analisada pela equipe antes da aprovação. 
                Você será notificado sobre o resultado.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={applyMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={applyMutation.isPending}>
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Candidatura"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
