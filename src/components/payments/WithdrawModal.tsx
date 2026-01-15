import { useState } from 'react';
import { ArrowUpFromLine, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useRequestWithdrawal } from '@/hooks/usePayments';
import type { PixKeyType } from '@/types/payment';

interface WithdrawModalProps {
  balance: number;
  onClose: () => void;
}

const pixKeyTypes: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: 'CPF', label: 'CPF', placeholder: '000.000.000-00' },
  { value: 'CNPJ', label: 'CNPJ', placeholder: '00.000.000/0000-00' },
  { value: 'EMAIL', label: 'E-mail', placeholder: 'seu@email.com' },
  { value: 'PHONE', label: 'Telefone', placeholder: '+55 11 99999-9999' },
  { value: 'RANDOM', label: 'Chave Aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
];

export function WithdrawModal({ balance, onClose }: WithdrawModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF');
  const requestWithdrawal = useRequestWithdrawal();
  const { toast } = useToast();

  const numericAmount = parseFloat(amount) || 0;
  // No withdrawal fee
  const fee = 0;
  const netAmount = numericAmount;
  const isValidAmount = numericAmount >= 20 && numericAmount <= Math.min(5000, balance);
  const isValidPixKey = pixKey.trim().length > 0;

  const handleWithdraw = async () => {
    if (!isValidAmount || !isValidPixKey) return;

    try {
      const result = await requestWithdrawal.mutateAsync({
        amount: numericAmount,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
      });

      toast({
        title: 'Saque solicitado!',
        description: result.message,
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Erro ao solicitar saque',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const selectedPixType = pixKeyTypes.find(t => t.value === pixKeyType);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-elevated animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Sacar</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Available Balance */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-bold">R${balance.toFixed(2)}</p>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label>Valor do saque</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 text-2xl font-bold h-14"
                placeholder="0,00"
                min={20}
                max={Math.min(5000, balance)}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mínimo R$20,00</span>
              <Button 
                variant="link" 
                className="h-auto p-0 text-xs"
                onClick={() => setAmount(Math.min(5000, balance).toString())}
              >
                Sacar tudo
              </Button>
            </div>
          </div>

          {/* PIX Key Type */}
          <div className="space-y-2">
            <Label>Tipo de chave PIX</Label>
            <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as PixKeyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pixKeyTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PIX Key Input */}
          <div className="space-y-2">
            <Label>Chave PIX</Label>
            <Input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={selectedPixType?.placeholder}
            />
          </div>

          {/* Processing Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Saque sem taxas! Processamento em até 24h úteis.
            </AlertDescription>
          </Alert>

          {/* Summary */}
          {isValidAmount && (
            <div className="space-y-2 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex justify-between pt-2">
                <span className="font-medium">Você receberá</span>
                <span className="text-xl font-bold text-orange-500">
                  R${netAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            className="w-full h-12 text-base"
            variant="outline"
            onClick={handleWithdraw}
            disabled={!isValidAmount || !isValidPixKey || requestWithdrawal.isPending}
          >
            {requestWithdrawal.isPending ? (
              'Processando...'
            ) : (
              <>
                <ArrowUpFromLine className="h-4 w-4 mr-2" />
                Solicitar Saque
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
