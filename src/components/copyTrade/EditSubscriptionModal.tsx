import { useState, useEffect } from "react";
import { CopySubscription } from "@/types/copyTrade";
import { useUpdateCopySubscription } from "@/hooks/useCopyTrade";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Settings, Zap, Percent, DollarSign } from "lucide-react";

interface EditSubscriptionModalProps {
  subscription: CopySubscription | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditSubscriptionModal({ subscription, isOpen, onClose }: EditSubscriptionModalProps) {
  const [autoCopy, setAutoCopy] = useState(true);
  const [maxTradeAmount, setMaxTradeAmount] = useState("100");
  const [copyPercentage, setCopyPercentage] = useState(100);
  
  const updateMutation = useUpdateCopySubscription();
  
  // Sync state with subscription when it changes
  useEffect(() => {
    if (subscription) {
      setAutoCopy(subscription.auto_copy);
      setMaxTradeAmount(subscription.max_trade_amount?.toString() || "100");
      setCopyPercentage(subscription.copy_percentage || 100);
    }
  }, [subscription]);
  
  const handleSave = async () => {
    if (!subscription) return;
    
    await updateMutation.mutateAsync({
      subscription_id: subscription.id,
      auto_copy: autoCopy,
      max_trade_amount: parseFloat(maxTradeAmount) || 100,
      copy_percentage: copyPercentage,
    });
    
    onClose();
  };
  
  if (!subscription) return null;
  
  const trader = subscription.trader;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <Avatar className="h-12 w-12">
              <AvatarImage src={trader?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {trader?.display_name?.charAt(0).toUpperCase() || "T"}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-left">Configurações de Copy</DialogTitle>
              <DialogDescription className="text-left">
                {trader?.display_name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Auto Copy Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="auto-copy" className="font-medium">
                  Copy Automático
                </Label>
                <p className="text-sm text-muted-foreground">
                  Copiar trades automaticamente
                </p>
              </div>
            </div>
            <Switch
              id="auto-copy"
              checked={autoCopy}
              onCheckedChange={setAutoCopy}
            />
          </div>
          
          {/* Max Trade Amount */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="max-amount">Valor Máximo por Trade</Label>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="max-amount"
                type="number"
                min="1"
                step="1"
                value={maxTradeAmount}
                onChange={(e) => setMaxTradeAmount(e.target.value)}
                className="pl-10"
                placeholder="100"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Limite máximo que você investirá em cada trade copiado
            </p>
          </div>
          
          {/* Copy Percentage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <Label>Percentual do Trade</Label>
              </div>
              <span className="text-sm font-medium text-primary">
                {copyPercentage}%
              </span>
            </div>
            <Slider
              value={[copyPercentage]}
              onValueChange={([value]) => setCopyPercentage(value)}
              min={10}
              max={100}
              step={10}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Percentual do valor do trade original que você copiará
            </p>
          </div>
          
          {/* Status Info */}
          {!autoCopy && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                ⚠️ Copy automático desativado. Você não receberá novos trades deste trader.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
