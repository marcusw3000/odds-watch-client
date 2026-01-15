import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, X, CreditCard, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCreateDeposit } from '@/hooks/usePayments';

interface DepositModalProps {
  onClose: () => void;
}

const quickAmounts = [50, 100, 200, 500, 1000];

export function DepositModal({ onClose }: DepositModalProps) {
  const [amount, setAmount] = useState<string>('100');
  const createDeposit = useCreateDeposit();
  const { toast } = useToast();

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount >= 10 && numericAmount <= 10000;

  const handleDeposit = async () => {
    if (!isValidAmount) return;

    try {
      const result = await createDeposit.mutateAsync(numericAmount);
      
      if (result.url) {
        // Open Stripe Checkout in new tab
        window.open(result.url, '_blank');
        toast({
          title: 'Redirecionando para pagamento',
          description: 'Complete o pagamento na nova aba.',
        });
        onClose();
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
      onClose();
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Depositar</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} type="button">
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
            {quickAmounts.map((value) => (
              <Button
                key={value}
                type="button"
                variant={numericAmount === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAmount(value.toString())}
              >
                R${value}
              </Button>
            ))}
          </div>

          {/* Payment Method Info */}
          <div className="space-y-3">
            <Label>Método de pagamento</Label>
            <div className="p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3 mb-3">
                <QrCode className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-sm">PIX</p>
                  <p className="text-xs text-muted-foreground">Instantâneo • Sem taxas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <CreditCard className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">Cartão de Crédito</p>
                  <p className="text-xs text-muted-foreground">Processamento imediato</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Escolha o método de pagamento no checkout</p>
            </div>
          </div>

          {/* Summary */}
          {isValidAmount && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
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
            className="w-full h-12 text-base"
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
