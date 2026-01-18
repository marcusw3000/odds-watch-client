import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CopyTrader } from "@/types/copyTrade";
import { formatCurrency } from "@/lib/formatters";
import { CreditCard, Wallet, AlertCircle, Loader2 } from "lucide-react";
import { useSubscribeCopyTrader } from "@/hooks/useCopyTrade";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface SubscribeModalProps {
  trader: CopyTrader | null;
  isOpen: boolean;
  onClose: () => void;
  userBalance?: number;
}

export function SubscribeModal({ trader, isOpen, onClose, userBalance = 0 }: SubscribeModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'STRIPE' | 'WALLET'>('WALLET');
  const [autoCopy, setAutoCopy] = useState(true);
  const [maxTradeAmount, setMaxTradeAmount] = useState('100');
  const [copyPercentage, setCopyPercentage] = useState('100');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const subscribeMutation = useSubscribeCopyTrader();
  
  if (!trader) return null;
  
  const monthlyFee = trader.monthly_fee ?? 0;
  const canPayWithWallet = userBalance >= monthlyFee;
  
  const handleSubmit = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    try {
      await subscribeMutation.mutateAsync({
        trader_id: trader.id,
        payment_method: paymentMethod,
        auto_copy: autoCopy,
        max_trade_amount: parseFloat(maxTradeAmount) || undefined,
        copy_percentage: parseFloat(copyPercentage) || undefined,
      });
      
      if (paymentMethod === 'WALLET') {
        onClose();
      }
      // Stripe will redirect automatically
    } catch {
      // Error handled by mutation
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-primary/20">
              <AvatarImage src={trader.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {trader.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="block">Seguir {trader.display_name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {monthlyFee > 0 ? `${formatCurrency(monthlyFee)}/mês` : 'Gratuito'}
              </span>
            </div>
          </DialogTitle>
          <DialogDescription>
            Configure como você quer copiar os trades deste trader.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Auto Copy Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-copy">Copy Automático</Label>
              <p className="text-xs text-muted-foreground">
                Copiar trades automaticamente quando o trader operar
              </p>
            </div>
            <Switch 
              id="auto-copy" 
              checked={autoCopy} 
              onCheckedChange={setAutoCopy} 
            />
          </div>
          
          {/* Copy Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-amount">Valor Máximo por Trade</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="max-amount"
                  type="number"
                  min="1"
                  value={maxTradeAmount}
                  onChange={(e) => setMaxTradeAmount(e.target.value)}
                  className="pl-9"
                  placeholder="100"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="copy-percentage">% do Trade</Label>
              <div className="relative">
                <Input
                  id="copy-percentage"
                  type="number"
                  min="1"
                  max="100"
                  value={copyPercentage}
                  onChange={(e) => setCopyPercentage(e.target.value)}
                  className="pr-8"
                  placeholder="100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
            </div>
          </div>
          
          {/* Payment Method */}
          {monthlyFee > 0 && (
            <div className="space-y-3">
              <Label>Forma de Pagamento</Label>
              <RadioGroup 
                value={paymentMethod} 
                onValueChange={(v) => setPaymentMethod(v as 'STRIPE' | 'WALLET')}
                className="grid grid-cols-2 gap-3"
              >
                <Label
                  htmlFor="wallet"
                  className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                    paymentMethod === 'WALLET' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  } ${!canPayWithWallet ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <RadioGroupItem value="WALLET" id="wallet" disabled={!canPayWithWallet} />
                  <Wallet className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">Saldo</span>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(userBalance)}
                    </p>
                  </div>
                </Label>
                
                <Label
                  htmlFor="stripe"
                  className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                    paymentMethod === 'STRIPE' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="STRIPE" id="stripe" />
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">Cartão</span>
                    <p className="text-xs text-muted-foreground">Stripe</p>
                  </div>
                </Label>
              </RadioGroup>
              
              {!canPayWithWallet && paymentMethod === 'WALLET' && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>Saldo insuficiente para esta assinatura</span>
                </div>
              )}
            </div>
          )}
          
          {/* Profit Share Info */}
          {trader.profit_share_percent != null && trader.profit_share_percent > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">
                <strong className="text-foreground">{trader.profit_share_percent}%</strong> dos seus 
                lucros com trades copiados serão compartilhados com o trader.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            className="w-full sm:w-auto"
            disabled={subscribeMutation.isPending || (monthlyFee > 0 && paymentMethod === 'WALLET' && !canPayWithWallet)}
          >
            {subscribeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {monthlyFee > 0 ? `Assinar por ${formatCurrency(monthlyFee)}/mês` : 'Seguir Gratuitamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
