import { useState, useRef, useCallback, useMemo } from 'react';
import { ArrowUpFromLine, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useRequestWithdrawal } from '@/hooks/usePayments';
import type { PixKeyType } from '@/types/payment';
import { cn } from '@/lib/utils';

interface WithdrawModalProps {
  balance: number;
  onClose: () => void;
}

// PIX validation patterns
const pixValidators: Record<PixKeyType, { pattern: RegExp; format?: (value: string) => string; maxLength: number }> = {
  CPF: {
    pattern: /^\d{11}$/,
    format: (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    },
    maxLength: 14,
  },
  CNPJ: {
    pattern: /^\d{14}$/,
    format: (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, 14);
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
      if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
      if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    },
    maxLength: 18,
  },
  EMAIL: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
  },
  PHONE: {
    pattern: /^\+?55?\d{10,11}$/,
    format: (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, 13);
      if (digits.length <= 2) return `+${digits}`;
      if (digits.length <= 4) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
      if (digits.length <= 9) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    },
    maxLength: 19,
  },
  RANDOM: {
    pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    format: (value: string) => {
      const hex = value.replace(/[^a-f0-9]/gi, '').toLowerCase().slice(0, 32);
      if (hex.length <= 8) return hex;
      if (hex.length <= 12) return `${hex.slice(0, 8)}-${hex.slice(8)}`;
      if (hex.length <= 16) return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12)}`;
      if (hex.length <= 20) return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16)}`;
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
    maxLength: 36,
  },
};

const pixKeyTypes: { value: PixKeyType; label: string; placeholder: string; hint: string }[] = [
  { value: 'CPF', label: 'CPF', placeholder: '000.000.000-00', hint: '11 dígitos' },
  { value: 'CNPJ', label: 'CNPJ', placeholder: '00.000.000/0000-00', hint: '14 dígitos' },
  { value: 'EMAIL', label: 'E-mail', placeholder: 'seu@email.com', hint: 'E-mail válido' },
  { value: 'PHONE', label: 'Telefone', placeholder: '+55 11 99999-9999', hint: 'Com DDD' },
  { value: 'RANDOM', label: 'Chave Aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'UUID válido' },
];

const DEBOUNCE_MS = 2000; // 2 seconds between attempts

export function WithdrawModal({ balance, onClose }: WithdrawModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [touched, setTouched] = useState(false);
  
  const requestWithdrawal = useRequestWithdrawal();
  const { toast } = useToast();
  const lastSubmitTime = useRef<number>(0);

  const numericAmount = parseFloat(amount) || 0;
  const fee = 0;
  const netAmount = numericAmount;
  const isValidAmount = numericAmount >= 20 && numericAmount <= Math.min(5000, balance);
  const isSubmitting = requestWithdrawal.isPending || isDebouncing;

  const selectedPixType = pixKeyTypes.find(t => t.value === pixKeyType);
  const validator = pixValidators[pixKeyType];

  // Validate PIX key
  const pixValidation = useMemo(() => {
    if (!pixKey.trim()) {
      return { isValid: false, error: null };
    }

    // For validation, extract raw value
    let rawValue = pixKey;
    if (pixKeyType === 'CPF' || pixKeyType === 'CNPJ') {
      rawValue = pixKey.replace(/\D/g, '');
    } else if (pixKeyType === 'PHONE') {
      rawValue = pixKey.replace(/\D/g, '');
    } else if (pixKeyType === 'RANDOM') {
      rawValue = pixKey.toLowerCase();
    }

    const isValid = validator.pattern.test(rawValue);
    
    if (!isValid) {
      let error = '';
      switch (pixKeyType) {
        case 'CPF':
          error = 'CPF deve ter 11 dígitos';
          break;
        case 'CNPJ':
          error = 'CNPJ deve ter 14 dígitos';
          break;
        case 'EMAIL':
          error = 'E-mail inválido';
          break;
        case 'PHONE':
          error = 'Telefone deve ter 10-11 dígitos com DDD';
          break;
        case 'RANDOM':
          error = 'Chave aleatória deve ser um UUID válido';
          break;
      }
      return { isValid: false, error };
    }

    return { isValid: true, error: null };
  }, [pixKey, pixKeyType, validator]);

  const isValidPixKey = pixValidation.isValid;
  const showPixError = touched && !pixValidation.isValid && pixKey.trim().length > 0;

  // Handle PIX key change with auto-formatting
  const handlePixKeyChange = useCallback((value: string) => {
    setTouched(true);
    
    if (validator.format) {
      const formatted = validator.format(value);
      setPixKey(formatted);
    } else {
      setPixKey(value.slice(0, validator.maxLength));
    }
  }, [validator]);

  // Reset PIX key when type changes
  const handlePixKeyTypeChange = useCallback((type: PixKeyType) => {
    setPixKeyType(type);
    setPixKey('');
    setTouched(false);
  }, []);

  // Get raw PIX key for submission
  const getRawPixKey = useCallback(() => {
    if (pixKeyType === 'CPF' || pixKeyType === 'CNPJ' || pixKeyType === 'PHONE') {
      return pixKey.replace(/\D/g, '');
    }
    return pixKey;
  }, [pixKey, pixKeyType]);

  const executeWithdrawal = useCallback(async () => {
    const now = Date.now();
    if (now - lastSubmitTime.current < DEBOUNCE_MS) {
      toast({
        title: 'Aguarde',
        description: 'Por favor, aguarde alguns segundos antes de tentar novamente.',
        variant: 'destructive',
      });
      return;
    }

    if (isSubmitting || !isValidAmount || !isValidPixKey) return;

    setIsDebouncing(true);
    lastSubmitTime.current = now;

    try {
      const result = await requestWithdrawal.mutateAsync({
        amount: numericAmount,
        pix_key: getRawPixKey(),
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
    } finally {
      setTimeout(() => setIsDebouncing(false), DEBOUNCE_MS);
    }
  }, [isSubmitting, isValidAmount, isValidPixKey, numericAmount, getRawPixKey, pixKeyType, requestWithdrawal, toast, onClose]);

  const handleRequestWithdraw = () => {
    if (!isValidAmount || !isValidPixKey) return;
    setShowConfirmation(true);
  };

  const handleConfirmWithdraw = async () => {
    setShowConfirmation(false);
    await executeWithdrawal();
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 animate-fade-in"
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
              <Select value={pixKeyType} onValueChange={(v) => handlePixKeyTypeChange(v as PixKeyType)}>
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
              <div className="flex justify-between items-center">
                <Label>Chave PIX</Label>
                {pixValidation.isValid && pixKey.trim() && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    Válida
                  </span>
                )}
              </div>
              <Input
                value={pixKey}
                onChange={(e) => handlePixKeyChange(e.target.value)}
                placeholder={selectedPixType?.placeholder}
                maxLength={validator.maxLength}
                className={cn(
                  showPixError && "border-destructive focus-visible:ring-destructive"
                )}
                aria-invalid={showPixError}
                aria-describedby={showPixError ? "pix-error" : undefined}
              />
              {showPixError ? (
                <p id="pix-error" className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {pixValidation.error}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {selectedPixType?.hint}
                </p>
              )}
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
              onClick={handleRequestWithdraw}
              disabled={!isValidAmount || !isValidPixKey || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Saque</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Você está solicitando um saque de:</p>
              <p className="text-lg font-semibold text-foreground">R${netAmount.toFixed(2)}</p>
              <p className="text-sm">Para a chave PIX ({selectedPixType?.label}):</p>
              <p className="font-mono text-sm bg-muted p-2 rounded break-all">{pixKey}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmWithdraw}>
              Confirmar Saque
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
