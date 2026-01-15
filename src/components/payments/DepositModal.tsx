import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, X, CreditCard, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useCreateDeposit } from '@/hooks/usePayments';
import { cn } from '@/lib/utils';

interface DepositModalProps {
  onClose: () => void;
}

const quickAmounts = [50, 100, 200, 500, 1000];

export function DepositModal({ onClose }: DepositModalProps) {
  const [amount, setAmount] = useState<string>('100');
  const [method, setMethod] = useState<'PIX' | 'CARD'>('PIX');
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const createDeposit = useCreateDeposit();
  const { toast } = useToast();

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount >= 10 && numericAmount <= 10000;

  // Trigger entrance animation on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(onClose, 200); // Wait for animation to complete
  };

  const handleDeposit = async () => {
    if (!isValidAmount) return;

    try {
      const result = await createDeposit.mutateAsync({ amount: numericAmount, method });
      
      if (result.url) {
        // Open Stripe Checkout in new tab
        window.open(result.url, '_blank');
        toast({
          title: 'Redirecionando para pagamento',
          description: 'Complete o pagamento na nova aba.',
        });
        handleClose();
      }
    } catch (error) {
      toast({
        title: 'Erro ao criar depósito',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const modalContent = (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-200",
        isVisible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0 backdrop-blur-none"
      )}
      onClick={handleBackdropClick}
    >
      <div 
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200",
          isVisible 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-95 translate-y-4"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Depositar</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} type="button">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="deposit-amount">Valor do depósito</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">R$</span>
              <Input
                id="deposit-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 text-2xl font-bold h-14"
                placeholder="0,00"
                min={10}
                max={10000}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo R$10,00 • Máximo R$10.000,00
            </p>
          </div>

          {/* Quick Amounts */}
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((value, index) => (
              <Button
                key={value}
                type="button"
                variant={numericAmount === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAmount(value.toString())}
                className={cn(
                  "transition-all duration-200",
                  isVisible && "animate-fade-in"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                R${value}
              </Button>
            ))}
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>Método de pagamento</Label>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as 'PIX' | 'CARD')}>
              <div
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                  method === 'PIX' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                )}
                onClick={() => setMethod('PIX')}
              >
                <RadioGroupItem value="PIX" id="deposit-method-pix" />
                <QrCode className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <Label htmlFor="deposit-method-pix" className="cursor-pointer font-medium">PIX</Label>
                  <p className="text-xs text-muted-foreground">Instantâneo • Sem taxas</p>
                </div>
              </div>

              <div
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                  method === 'CARD' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                )}
                onClick={() => setMethod('CARD')}
              >
                <RadioGroupItem value="CARD" id="deposit-method-card" />
                <CreditCard className="h-5 w-5 text-blue-500" />
                <div className="flex-1">
                  <Label htmlFor="deposit-method-card" className="cursor-pointer font-medium">Cartão de Crédito</Label>
                  <p className="text-xs text-muted-foreground">Processamento imediato</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Summary */}
          {isValidAmount && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 animate-fade-in">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Você receberá</span>
                <span className="text-xl font-bold text-green-500">
                  R${numericAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="button"
            className="w-full h-12 text-base transition-transform active:scale-[0.98]"
            onClick={handleDeposit}
            disabled={!isValidAmount || createDeposit.isPending}
          >
            {createDeposit.isPending ? (
              'Processando...'
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Depositar R${numericAmount.toFixed(2)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  // Use portal to render outside of header
  return createPortal(modalContent, document.body);
}
